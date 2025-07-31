const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Report = require('../models/Report'); 
const upload = require('../middleware/multerUpload'); 
const { bucket } = require('../config/db'); 

/* ---------- Handles the creation of a new report, including optional media file upload to GridFS ---------- */
/* 
  This endpoint accepts multipart/form-data with an optional media file (field 'mediaFile').
  It parses location details from a JSON string in req.body.locationDetails.
  If a file is uploaded, stores it to GridFS, then creates a new Report document referencing the media file ID.
  Logs key steps and errors with professional, clear messages.
*/
router.post('/reports', upload.single('mediaFile'), async (req, res) => {
  console.log('[Server] Received new report submission. File info:', req.file);
  console.log('[Server] Request body:', req.body);

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
    console.error('[Server] Error saving report:', err.message);
    res.status(500).json({ message: 'Failed to save report.' });
  }
});

/* ---------- Retrieves a single report by its ID ---------- */
/* 
  Finds a report by MongoDB ObjectId.
  Returns 404 if not found or 400 if invalid ID format.
  Logs errors professionally.
*/
router.get('/reports/:id', async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found.' });
    res.json(report);
  } catch (err) {
    console.error('[Server] Error fetching report:', err.message);
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid Report ID format.' });
    }
    res.status(500).json({ message: 'Failed to load report details.' });
  }
});

/* ---------- Retrieves location data for all reports to display on a map ---------- */
/* 
  Queries all reports and maps them to a simplified object containing lat/lng, title, and status.
  Filters out reports with missing or invalid coordinates.
*/
router.get('/all-reports-locations', async (req, res) => {
  try {
    const allReports = await Report.find({}, 'location.latitude location.longitude faultType status');
    const locations = allReports.map(report => {
      if (report.location && typeof report.location.latitude === 'number' && typeof report.location.longitude === 'number') {
        return {
          lat: report.location.latitude,
          lng: report.location.longitude,
          title: report.faultType || 'Report',
          status: report.status 
        };
      }
      return null;
    }).filter(Boolean);
    res.status(200).json(locations);
  } catch (error) {
    console.error('[Server] Error fetching all reports locations:', error.message);
    res.status(500).json({ message: 'Server error while retrieving all report locations.' });
  }
});

/* ---------- Handles updates to an existing report's status or municipality response ---------- */
/* 
  Updates 'status' and/or 'municipalityResponse' fields of a report.
  Validates existence of report and update content.
*/
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
    console.error('[Server] Error updating report:', err.message);
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid Report ID format.' });
    }
    res.status(500).json({ message: 'Failed to update report.' });
  }
});

/* ---------- Updates location data of a report ---------- */
/* 
  Requires city and street fields.
  Updates report location and assumes manual location override.
  Handles errors and validates report existence.
*/
router.put('/reports/:id/location', async (req, res) => {
  const reportId = req.params.id;
  const { city, street, houseNumber, latitude, longitude } = req.body;

  if (!city || !street) {
    return res.status(400).json({ message: 'City and street are required for location update.' });
  }

  try {
    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Report not found.' });
    }

    report.location.city = city;
    report.location.street = street;
    report.location.houseNumber = houseNumber || '';
    report.location.latitude = latitude;
    report.location.longitude = longitude;
    await report.save();

    res.json({ message: 'Report location updated successfully.', report });
  } catch (err) {
    console.error('[Server] Error updating report location:', err.message);
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid Report ID format.' });
    }
    res.status(500).json({ message: 'Server error while updating report location.' });
  }
});

/* ---------- Retrieves a list of reports, optionally filtered by creator ID ---------- */
/* 
  Allows filtering reports by creatorId query parameter.
  Returns all reports sorted by timestamp descending if no filter.
*/
router.get('/reports', async (req, res) => {
  try {
    const query = req.query.creatorId ? { creatorId: req.query.creatorId } : {};
    const reports = await Report.find(query).sort({ timestamp: -1 });
    res.json(reports);
  } catch (err) {
    console.error('[Server] Error fetching reports:', err.message);
    res.status(500).json({ message: 'Failed to load reports.' });
  }
});

/* ---------- Retrieves reports relevant to an employee based on city and optional status ---------- */
/* 
  Filters reports by location.city and optionally by status.
  If status is 'all' or omitted, returns all statuses.
*/
router.get('/employee-reports', async (req, res) => {
  try {
    const { city, status } = req.query;
    if (!city) return res.status(400).json({ message: 'Missing employee city.' });
    const query = { 'location.city': city };
    if (status && status !== 'all') query.status = status;
    const reports = await Report.find(query).sort({ timestamp: -1 });
    res.json(reports);
  } catch (err) {
    console.error('[Server] Error fetching employee reports:', err.message);
    res.status(500).json({ message: 'Failed to load employee-relevant reports.' });
  }
});

/* ---------- Handles the deletion of a report and its associated media file from GridFS ---------- */
/* 
  Validates user ownership before deleting.
  Deletes associated media file from GridFS collections.
  Handles errors carefully and logs all operations.
*/
router.delete('/reports/:id', async (req, res) => {
  const reportId = req.params.id;
  const userId = req.query.userId;

  try {
    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: 'Report not found.' });
    }
    if (report.creatorId.toString() !== userId) {
      return res.status(403).json({ message: 'You are not authorized to delete this report.' });
    }

    if (report.media) {
      try {
        const mediaFileId = new mongoose.Types.ObjectId(report.media);
        await mongoose.connection.db.collection('uploads.files').deleteOne({ _id: mediaFileId });
        await mongoose.connection.db.collection('uploads.chunks').deleteMany({ files_id: mediaFileId });
        console.log(`[Server] Media file deleted from GridFS: ${report.media}`);
      } catch (err) {
        console.error(`[Server] Error deleting media file from GridFS (${report.media}):`, err);
      }
    }

    await Report.findByIdAndDelete(reportId);
    res.json({ message: 'Report deleted successfully.' });
  } catch (err) {
    console.error('[Server] Error deleting report:', err.message);
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid Report ID format.' });
    }
    res.status(500).json({ message: 'Server error while deleting report.' });
  }
});

/* ---------- Serves a media file from GridFS based on its file ID ---------- */
/* 
  Streams the requested file from GridFS to the response.
  Sets appropriate Content-Type and Content-Disposition headers.
  Handles errors including file not found and invalid ID.
*/
router.get('/media/:fileId', async (req, res) => {
  try {
    const currentBucket = bucket(); 
    if (!currentBucket) {
      console.error('[Server] GridFSBucket is not initialized yet during media download.');
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
    downloadStream.on('error', (err) => {
      console.error('[Server] Error streaming file:', err);
      res.sendStatus(500);
    });
    downloadStream.pipe(res);
  } catch (err) {
    console.error('[Server] Error fetching file from GridFS:', err.message);
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid file ID format.' });
    }
    res.status(500).json({ message: 'Failed to retrieve media file.' });
  }
});

module.exports = router;
