const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "pimentor.education@gmail.com",
    pass: "qxft qlng orph wmei", // Your App Password
  },
});

const sendEmail = async (to, subject, html) => {
  try {
    await transporter.sendMail({
      from: '"PiMentor Support" <pimentor.education@gmail.com>',
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error("Mailer Error:", error);
    return false;
  }
};

module.exports = sendEmail;