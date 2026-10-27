const { Resend } = require("resend");
const { Error } = require("sequelize");
const resend = new Resend(process.env.RESEND_API_KEY);

async function testMail() {
      const from = "Desarrollo<desarrollo@serviciosrivera.com>";

      // Create sample file content
      const fileContent = `Sample Attachment\n==================\n\nThis file was attached to your email.\nSent at: ${new Date().toISOString()}\n`;
      const encoded = Buffer.from(fileContent).toString("base64");

      // Maximum total attachment size: 40MB
      const { data, error } = await resend.emails.send({
            from,
            to: ["luisrivera4540@gmail.com"],
            subject: "Email with Attachment",
            html: "<h1>Your attachment is ready</h1><p>Please find the file attached to this email.</p>",
            attachments: [
                  {
                        filename: "sample.txt",
                        content: encoded,
                  },
            ],
      });

      if (error) {
            console.error("Error sending email:", error);
            return {
                  status: 'error',
                  message: 'Failed to send email',
                  error: error,
            };
      }
      return {
            status: 'success',
            message: 'Email sent successfully',
            data: data,
      };
}


module.exports = { testMail };

