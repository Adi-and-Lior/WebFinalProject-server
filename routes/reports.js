const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Report = require('../models/Report'); 
const upload = require('../middleware/multerUpload'); 
const { bucket } = require('../config/db'); 

/* ---------- Handles the creation of a new report, including optional media file upload to GridFS ---------- */
router.post('/reports', upload.single('mediaFile'), async (req, res) => {
  console.log('[Server] req.file:', req.file);
  console.log('[Server] req.body:', req.body);
  let location;
  try {
    location = JSON.parse(req.body.locationDetails);
    console.log('[Server] Parsed location:', location);
    if (!location.city) {
      return res.status(400).json({ message: 'Location details must include a city.' });
    }
  } catch {
    return res.status(400).json({ message: 'Invalid location details format.' });
  }
  let mediaId = null;
  let mediaMimeType = null;
  try {
    if (req.file) {
      mediaId = await new Promise((resolve, reject) => {
        const currentBucket = bucket(); 
        if (!currentBucket) {
          console.error('[Server] Error: GridFSBucket is not initialized for upload.');
          return reject(new Error('GridFSBucket not ready for upload.'));
        }
        const uploadStream = currentBucket.openUploadStream(req.file.originalname, { 
          contentType: req.file.mimetype,
        });
        uploadStream.end(req.file.buffer);
        uploadStream.on('finish', () => {
          console.log('[Server] File uploaded to GridFS with id:', uploadStream.id);
          resolve(uploadStream.id);
        });
        uploadStream.on('error', (err) => {
          console.error('[Server] Error uploading file to GridFS:', err);
          reject(err);
        });
      });
      mediaMimeType = req.file.mimetype;
    }
    const newReport = await new Report({
      faultType: req.body.faultType,
      faultDescription: req.body.faultDescription,
      location,
      media: mediaId,
      mediaMimeType,
      createdBy: req.body.createdBy,
      creatorId: req.body.creatorId,
      status: 'in-progress'
    }).save();
    res.status(201).json({
      message: 'Report submitted successfully!',
      reportId: newReport._id.toString(),
      mediaGridFSId: mediaId ? mediaId.toString() : null,
      mediaMimeType
    });
  } catch (err) {
    console.error('Error saving report:', err.message);
    res.status(500).json({ message: 'Failed to save report.' });
  }
});

/* ---------- Retrieves a single report by its ID ---------- */
router.get('/reports/:id', async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found.' });
    res.json(report);
  } catch (err) {
    console.error('Error fetching report:', err.message);
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid Report ID format.' });
    }
    res.status(500).json({ message: 'Failed to load report details.' });
  }
});

/* ---------- Retrieves location data for all reports to display on a map ---------- */
router.get('/all-reports-locations', async (req, res) => {
  try {
    const allReports = await Report.find({}, 'location.latitude location.longitude faultType');
    const locations = allReports.map(report => {
      if (report.location && typeof report.location.latitude === 'number' && typeof report.location.longitude === 'number') {
        return {
          lat: report.location.latitude,
          lng: report.location.longitude,
          title: report.faultType || 'דיווח'
        };
      }
      return null;
    }).filter(Boolean);
    res.status(200).json(locations);
  } catch (error) {
    console.error('שגיאה בשליפת מיקומי כל הדיווחים למפה:', error.message);
    res.status(500).json({ message: 'שגיאה בשרת בעת שליפת מיקומי כל הדיווחים.' });
  }
});

/* ---------- Handles updates to an existing report's status or municipality response ---------- */
router.put('/reports/:id', async (req, res) => {
  const { status, municipalityResponse } = req.body;
  if (status === undefined && municipalityResponse === undefined) {
    return res.status(400).json({ message: 'Nothing to update.' });
  }
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found.' });
    if (status !== undefined) report.status = status;
    if (municipalityResponse !== undefined) report.municipalityResponse = municipalityResponse;
    await report.save();
    res.json({ message: 'Report updated successfully.', report });
  } catch (err) {
    console.error('Error updating report:', err.message);
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid Report ID format.' });
    }
    res.status(500).json({ message: 'Failed to update report.' });
  }
});

/* ---------- Retrieves a list of reports, optionally filtered by creator ID ---------- */
router.get('/reports', async (req, res) => {
  try {
    const query = req.query.creatorId ? { creatorId: req.query.creatorId } : {};
    const reports = await Report.find(query).sort({ timestamp: -1 });
    res.json(reports);
  } catch (err) {
    console.error('Error fetching reports:', err.message);
    res.status(500).json({ message: 'Failed to load reports.' });
  }
});

/* ---------- Retrieves reports relevant to an employee based on city and optional status ---------- */
router.get('/employee-reports', async (req, res) => {
  try {
    const { city, status } = req.query;
    if (!city) return res.status(400).json({ message: 'Missing employee city.' });
    const query = { 'location.city': city };
    if (status && status !== 'all') query.status = status;
    const reports = await Report.find(query).sort({ timestamp: -1 });
    res.json(reports);
  } catch (err) {
    console.error('Error fetching employee reports:', err.message);
    res.status(500).json({ message: 'Failed to load employee-relevant reports.' });
  }
});

/* ---------- Handles the deletion of a report and its associated media file from GridFS ---------- */
router.delete('/reports/:id', async (req, res) => {
  const reportId = req.params.id;
  const userId = req.query.userId;
  try {
    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: 'הדיווח לא נמצא.' });
    }
    if (report.creatorId.toString() !== userId) {
      return res.status(403).json({ message: 'אין לך הרשאה למחוק דיווח זה.' });
    }
    if (report.media) {
      try {
        const mediaFileId = new mongoose.Types.ObjectId(report.media);
        await mongoose.connection.db.collection('uploads.files').deleteOne({ _id: mediaFileId });
        await mongoose.connection.db.collection('uploads.chunks').deleteMany({ files_id: mediaFileId });
        console.log(`Media file deleted from GridFS: ${report.media}`);
      } catch (err) {
        console.error(`שגיאה במחיקת קובץ מדיה מ-GridFS (${report.media}):`, err);
      }
    }
    await Report.findByIdAndDelete(reportId);
    res.json({ message: 'הדיווח נמחק בהצלחה.' });
  } catch (err) {
    console.error('שגיאה במחיקת דיווח:', err.message);
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'מזהה דיווח לא תקין.' });
    }
    res.status(500).json({ message: 'שגיאה בשרת בעת מחיקת הדיווח.' });
  }
});

/* ---------- Serves a media file from GridFS based on its file ID ---------- */
router.get('/media/:fileId', async (req, res) => {
  try {
    const currentBucket = bucket(); 
    if (!currentBucket) {
      console.error('GridFSBucket is not initialized yet during media download.');
      return res.status(500).json({ message: 'Server error: GridFSBucket not ready for download.' });
    }
    console.log('[Server] Requested fileId:', req.params.fileId);
    const fileId = new mongoose.Types.ObjectId(req.params.fileId);
    const files = await mongoose.connection.db.collection('uploads.files').find({ _id: fileId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'No file exists.' });
    }
    const file = files[0];
    res.set('Content-Type', file.contentType);
    res.set('Content-Disposition', `inline; filename="${file.filename}"`);
    const downloadStream = currentBucket.openDownloadStream(fileId);
    console.log('[Server] Found files:', files);
    downloadStream.on('error', (err) => {
      console.error('Error streaming file:', err);
      console.error(err.stack);
      res.sendStatus(500);
    });
    downloadStream.pipe(res);
  } catch (err) {
    console.error('Error fetching file from GridFS:', err.message);
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid file ID format.' });
    }
    res.status(500).json({ message: 'Failed to retrieve media file.' });
  }
});

module.exports = router;