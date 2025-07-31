const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Report = require('../models/Report'); 
const upload = require('../middleware/multerUpload'); 
const { bucket } = require('../config/db'); 

/* ---------- Handles the creation of a new report, including optional media file upload to GridFS ---------- */
// routes/reports.js (או הקובץ שבו נמצא הראוטר הזה)

// וודא ש Multer וה-GridFsStorage מוגדרים כאן לפני הראוטר
// לדוגמה:
const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const Report = require('../models/Report'); // וודא שזה הנתיב הנכון למודל הדיווח שלך
const { bucket } = require('../config/db'); // <--- וודא שאתה מייבא את bucket מ-config/db.js

// ----------------------------------------------------------------------
// קטע קוד זה חייב להיות קיים בראש הקובץ (לפני הראוטר)
// הוא מגדיר את Multer להשתמש ב-GridFSStorage.
// אם כבר יש לך את זה, אל תדביק שוב, רק וודא שזה נכון.
const storage = new GridFsStorage({
    url: process.env.MONGO_URI, // וודא ש-MONGO_URI נכון
    file: (req, file) => {
        return {
            filename: file.originalname,
            bucketName: 'uploads' // שם הבאקט
        };
    }
});

const upload = multer({ storage }); // Multer משתמש באחסון GridFS
// ----------------------------------------------------------------------


router.post('/reports', upload.single('mediaFile'), async (req, res) => {
    // לוגים לבדיקה
    console.log('[Server] req.file (after Multer-GridFS):', req.file); // זה אמור להכיל את ה-ID
    console.log('[Server] req.body:', req.body);

    let location;
    try {
        location = JSON.parse(req.body.locationDetails);
        console.log('[Server] Parsed location:', location);
        if (!location.city) {
            return res.status(400).json({ message: 'Location details must include a city.' });
        }
    } catch (parseError) { // עדיף לתפוס את השגיאה כמשתנה
        console.error('[Server] Error parsing location details:', parseError);
        return res.status(400).json({ message: 'Invalid location details format.' });
    }

    let mediaId = null;
    let mediaMimeType = null;

    // ---------------------------------------------------------------------------------
    // זהו הקטע שאתה צריך לשנות / להחליף לחלוטין.
    // אם Multer עם GridFsStorage עובד כראוי, ה-ID כבר ב-req.file.id
    // ---------------------------------------------------------------------------------
    if (req.file) {
        mediaId = req.file.id; // <--- קריטי: קח את ה-ID ישירות מ-req.file.id
        mediaMimeType = req.file.mimetype;
        console.log('[Server] Media ID retrieved from req.file.id:', mediaId);
    }
    // ---------------------------------------------------------------------------------
    // כל בלוק ה-Promise עם currentBucket.openUploadStream צריך להימחק לחלוטין!
    // כלומר, למחוק מ:
    // mediaId = await new Promise((resolve, reject) => {
    //   const currentBucket = bucket();
    //   ...
    //   });
    // ועד השורה שמסיימת את ה-Promise.
    // ---------------------------------------------------------------------------------

    try {
        const newReport = await new Report({
            faultType: req.body.faultType,
            faultDescription: req.body.faultDescription,
            location,
            media: mediaId, // שדה זה ישמור את ה-ObjectID של הקובץ ב-GridFS
            mediaMimeType,
            createdBy: req.body.createdBy,
            creatorId: req.body.creatorId,
            status: 'in-progress'
        }).save();

        res.status(201).json({
            message: 'Report submitted successfully!',
            reportId: newReport._id.toString(),
            mediaId: mediaId ? mediaId.toString() : null, // <--- וודא שאתה שולח mediaId ולא mediaGridFSId
            mediaMimeType: mediaMimeType
        });

    } catch (err) {
        console.error('Error saving report:', err.message);
        // טיפול בהסרת קובץ "יתום" אם שמירת הדיווח נכשלה
        // וודא ש-bucket מוגדר ונגיש כאן (מהייבוא למעלה)
        if (mediaId && bucket) { 
            try {
                // ה-ID מ-req.file.id הוא כבר ObjectID, אז delete אמור לעבוד
                await bucket.delete(mediaId); 
                console.log(`[Server] Deleted orphaned file ${mediaId} from GridFS.`);
            } catch (deleteErr) {
                console.error(`[Server] Error deleting orphaned file ${mediaId}:`, deleteErr);
            }
        }
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
    const allReports = await Report.find({}, 'location.latitude location.longitude faultType status');
    const locations = allReports.map(report => {
      if (report.location && typeof report.location.latitude === 'number' && typeof report.location.longitude === 'number') {
        return {
          lat: report.location.latitude,
          lng: report.location.longitude,
          title: report.faultType || 'דיווח',
          status: report.status 
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
router.put('/reports/:id/location', async (req, res) => {
  const reportId = req.params.id;
  const { city, street, houseNumber,latitude, longitude } = req.body;

  // ולידציה בסיסית של הנתונים
  if (!city || !street) {
    return res.status(400).json({ message: 'נדרשים עיר ורחוב לעדכון מיקום.' });
  }

  try {
    const report = await Report.findById(reportId);

    if (!report) {
      return res.status(404).json({ message: 'הדיווח לא נמצא.' });
    }

    // עדכון שדות המיקום
    // נניח שזה הופך למיקום ידני 
    report.location.city = city;
    report.location.street = street;
    report.location.houseNumber = houseNumber || ''; // אם houseNumber לא סופק, יהיה ריק
    report.location.latitude = latitude;
    report.location.longitude = longitude;
    await report.save();
    res.json({ message: 'מיקום הדיווח עודכן בהצלחה.', report });
  } catch (err) {
    console.error('שגיאה בעדכון מיקום הדיווח:', err.message);
    if (err.name === 'CastError') {
      return res.status(400).json({ message: 'מזהה דיווח לא תקין.' });
    }
    res.status(500).json({ message: 'שגיאה בשרת בעת עדכון מיקום הדיווח.' });
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