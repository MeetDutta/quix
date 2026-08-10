import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.enabled = True

    def _send_smtp_email(self, to_email: str, subject: str, html_content: str):
        """Transmits raw HTML email via SMTP server if settings are configured in backend/.env."""
        if settings.SMTP_HOST and settings.SMTP_USER:
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
                msg["To"] = to_email
                
                msg.attach(MIMEText(html_content, "html"))
                
                with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                    server.starttls()
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                    server.send_message(msg)
                logger.info(f"⚡ Real SMTP email transmitted to {to_email}")
                print(f"⚡ Real SMTP email transmitted to {to_email}")
            except Exception as e:
                logger.error(f"Failed to transmit SMTP email to {to_email}: {str(e)}")

    def send_student_welcome_email(self, student_name: str, email: str, password: str, roll_number: Optional[str] = None):
        """Dispatches an automated welcome email with student portal login credentials."""
        portal_url = "http://localhost:3000"
        subject = "Welcome to EduQuizX — Student Account Created"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; background-color: #FAF7F2; padding: 20px; color: #1C1917;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 30px; border: 1px solid #E7E0D3;">
                <h2 style="color: #9A3412; margin-top: 0;">Welcome to EduQuizX Portal</h2>
                <p>Hello <b>{student_name}</b>,</p>
                <p>Your student account has been provisioned successfully. Below are your official portal credentials:</p>
                
                <div style="background-color: #FBF9F5; border: 1px solid #E7E0D3; border-radius: 12px; padding: 20px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><b>Roll Number:</b> {roll_number or 'N/A'}</p>
                    <p style="margin: 5px 0;"><b>Portal Username / Email:</b> <span style="color: #9A3412; font-family: monospace;">{email}</span></p>
                    <p style="margin: 5px 0;"><b>Default Password:</b> <span style="color: #047857; font-family: monospace;">{password}</span></p>
                </div>
                
                <p>You can sign in to view your analytics and exam results here:</p>
                <p><a href="{portal_url}" style="display: inline-block; background: #9A3412; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: bold;">Login to Student Portal</a></p>
                
                <hr style="border: none; border-top: 1px solid #E7E0D3; margin-top: 30px;" />
                <p style="font-size: 11px; color: #78716C;">EduQuizX Examination System • Automated System Notification</p>
            </div>
        </body>
        </html>
        """
        
        logger.info(f"📧 [EMAIL DISPATCHED] Welcome email queued for {student_name} ({email}) | Pass: {password}")
        print(f"📧 [EMAIL DISPATCHED] Welcome email queued for {student_name} ({email}) | Pass: {password}")
        self._send_smtp_email(email, subject, html_content)

    def send_exam_credentials_email(
        self, 
        student_name: str, 
        email: str, 
        exam_name: str, 
        exam_code: str, 
        username: str, 
        password: str
    ):
        """Dispatches an automated email to student containing test link, exam username, and passcode PIN."""
        exam_link = f"http://localhost:8000/static/exam.html?code={exam_code}"
        subject = f"Exam Notification & Access Credentials — {exam_name}"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; background-color: #FAF7F2; padding: 20px; color: #1C1917;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 30px; border: 1px solid #E7E0D3;">
                <h2 style="color: #9A3412; margin-top: 0;">Secured Exam Credentials & Portal Link</h2>
                <p>Hello <b>{student_name}</b>,</p>
                <p>You have been enrolled for the examination: <b>{exam_name}</b> (Code: <b style="color: #9A3412;">{exam_code}</b>).</p>
                
                <div style="background-color: #FBF9F5; border: 1px solid #E7E0D3; border-radius: 12px; padding: 20px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><b>Exam Session Username:</b> <span style="color: #9A3412; font-family: monospace; font-size: 16px;">{username}</span></p>
                    <p style="margin: 5px 0;"><b>Exam Passcode / PIN:</b> <span style="color: #047857; font-family: monospace; font-size: 16px; background: #ECFDF5; padding: 2px 8px; border-radius: 4px;">{password}</span></p>
                    <p style="margin: 5px 0;"><b>Exam Code:</b> {exam_code}</p>
                </div>
                
                <p>Click the link below to enter the secure exam gateway when your exam window opens:</p>
                <p><a href="{exam_link}" style="display: inline-block; background: #9A3412; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: bold;">Open Exam Portal Link</a></p>
                
                <hr style="border: none; border-top: 1px solid #E7E0D3; margin-top: 30px;" />
                <p style="font-size: 11px; color: #78716C;">EduQuizX Proctoring Portal • Confidential Student Credentials</p>
            </div>
        </body>
        </html>
        """
        
        logger.info(f"📧 [EMAIL DISPATCHED] Exam Credentials queued for {student_name} ({email}) | Code: {exam_code} | PIN: {password}")
        print(f"📧 [EMAIL DISPATCHED] Exam Credentials queued for {student_name} ({email}) | Code: {exam_code} | PIN: {password}")
        self._send_smtp_email(email, subject, html_content)

email_service = EmailService()
