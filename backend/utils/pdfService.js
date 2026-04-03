const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const generateMonthlyPDF = (studentData, courseTitle, reportData, overallScore, res = null) => {
    // Standard A4 document
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    if (res) doc.pipe(res);

    // --- Header Section ---
    const logoPath = path.join(__dirname, '../images/OUR_LOGO.jpeg');
    if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 45, { width: 50 });
    }
    
    doc.fillColor('#7c4dff').fontSize(25).font('Helvetica-Bold').text('PiMentor', 110, 57);
    doc.fontSize(10).fillColor('#666666').font('Helvetica').text('The Galaxy of Excellence in Mathematical-Sciences', 110, 85);
    doc.moveTo(50, 110).lineTo(550, 110).strokeColor('#eeeeee').stroke();

    // Watermark (Placed in background)
    doc.save().opacity(0.05).fontSize(60).fillColor('black').text('PIMENTOR OFFICIAL', 100, 350, { rotation: 45 });
    doc.restore();

    // --- Student & Course Info (Fixed position to stay on Page 1) ---
    const infoTop = 130;
    doc.fillColor('#333333').fontSize(12).font('Helvetica-Bold').text(`STUDENT: ${studentData.name.toUpperCase()}`, 50, infoTop);
    doc.text(`COURSE: ${courseTitle.toUpperCase()}`, 50, infoTop + 18);
    doc.fontSize(10).font('Helvetica').text(`Generated on: ${new Date().toLocaleDateString()}`, 50, infoTop + 36);

    // --- Table Alignment Logic ---
    const col1 = 60;  // Lecture Title
    const col2 = 380; // Status
    const col3 = 490; // Score
    let y = 200;      // Start table high enough to stay on Page 1

    // Header Background
    doc.rect(50, y, 500, 25).fill('#7c4dff');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10);
    doc.text('LECTURE TITLE', col1, y + 8);
    doc.text('STATUS', col2, y + 8);
    doc.text('SCORE', col3, y + 8);

    y += 25; 
    doc.font('Helvetica').fontSize(10);

    // Table Rows
    reportData.forEach((item, index) => {
        // Stripe background
        if (index % 2 === 0) {
            doc.save().fillColor('#f9f9f9').rect(50, y, 500, 22).fill().restore();
        }

        doc.fillColor('#333333');
        // baseline: 'top' ensures perfect horizontal alignment across columns
        doc.text(item.title, col1, y + 6, { width: 300, lineBreak: false, baseline: 'top' });
        doc.text(item.isVideoCompleted ? 'WATCHED' : 'PENDING', col2, y + 6, { baseline: 'top' });
        
        const scoreText = (item.highestQuizScore === -1) ? 'N/A' : `${item.highestQuizScore}/10`;
        doc.text(scoreText, col3, y + 6, { baseline: 'top' });
        
        y += 22;

        // Page break if too long
        if (y > 700) {
            doc.addPage();
            y = 50; 
        }
    });

    // --- Aggregate Section ---
    let aggY = y + 20;
    if (aggY > 740) { doc.addPage(); aggY = 50; }

    doc.moveTo(50, aggY).lineTo(550, aggY).strokeColor('#eeeeee').stroke();
    doc.fontSize(16).fillColor('#7c4dff').font('Helvetica-Bold').text(`Overall Aggregate: ${overallScore}%`, 50, aggY + 15, { align: 'right', width: 500 });

    // --- Signature Footer ---
    const footerY = 750;
    const signPath = path.join(__dirname, '../images/HOD_sign.jpg');
    if (fs.existsSync(signPath)) {
        doc.image(signPath, 440, footerY - 45, { width: 70 });
    }
    doc.moveTo(410, footerY).lineTo(540, footerY).strokeColor('#333').stroke();
    doc.fontSize(9).fillColor('#000').font('Helvetica-Bold').text('Harsh Vardhan Vishwakarma', 390, footerY + 8, { align: 'right', width: 150 });
    doc.fontSize(7).font('Helvetica').text('Founder / HOD Mathematical Sciences', 390, footerY + 22, { align: 'right', width: 150 });

    doc.end();
};

module.exports = { generateMonthlyPDF };