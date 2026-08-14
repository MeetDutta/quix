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
        """Transmits raw HTML email via SMTP server if settings are configured in backend environment."""
        if settings.SMTP_HOST and settings.SMTP_USER:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
            msg["To"] = to_email
            msg.attach(MIMEText(html_content, "html"))
            
            # Primary Attempt (STARTTLS Port 587 or configured port)
            try:
                if settings.SMTP_PORT == 465:
                    with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                        server.send_message(msg)
                else:
                    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                        server.starttls()
                        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                        server.send_message(msg)
                logger.info(f"⚡ Real SMTP email transmitted to {to_email}")
                print(f"⚡ Real SMTP email transmitted to {to_email}")
                return True
            except Exception as primary_err:
                logger.warning(f"⚠️ Primary SMTP attempt failed ({primary_err}), attempting SSL fallback port 465...")
                print(f"⚠️ Primary SMTP attempt failed ({primary_err}), attempting SSL fallback port 465...")
                try:
                    # Fallback to SSL Port 465
                    with smtplib.SMTP_SSL(settings.SMTP_HOST, 465, timeout=10) as server:
                        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                        server.send_message(msg)
                    logger.info(f"⚡ Fallback SSL SMTP email transmitted to {to_email}")
                    print(f"⚡ Fallback SSL SMTP email transmitted to {to_email}")
                    return True
                except Exception as fallback_err:
                    logger.error(f"❌ SMTP delivery failed for {to_email}: Primary={primary_err}, Fallback={fallback_err}")
                    print(f"❌ SMTP delivery failed for {to_email}: Primary={primary_err}, Fallback={fallback_err}")
                    return False
        else:
            logger.warning(f"⚠️ SMTP credentials not set on server. Missing SMTP_HOST ('{settings.SMTP_HOST}') or SMTP_USER ('{settings.SMTP_USER}').")
            print(f"⚠️ SMTP credentials not set on server. Missing SMTP_HOST ('{settings.SMTP_HOST}') or SMTP_USER ('{settings.SMTP_USER}').")
            return False

    def send_student_authorization_email(self, student_name: str, email: str, verification_token: str, roll_number: Optional[str] = None):
        """Dispatches an authorization email requesting the student to verify their account or authorize with Google."""
        verify_url = f"{settings.FRONTEND_URL}/verify-student?token={verification_token}"
        subject = "Action Required: Authorize Your EduQuizX Student Account"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7F4EF; padding: 24px; color: #242321;">
            <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #E5E0D8;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                    <div style="background-color: #C84B18; color: #ffffff; padding: 8px 12px; border-radius: 8px; font-weight: bold; font-size: 16px;">EduQuizX</div>
                    <span style="font-size: 12px; color: #716D67;">Academic Authorization Portal</span>
                </div>

                <h2 style="color: #242321; margin-top: 0; font-size: 20px; font-weight: 700;">Authorize Your Student Account</h2>
                <p style="font-size: 14px; line-height: 1.6;">Hello <b>{student_name}</b>,</p>
                <p style="font-size: 14px; line-height: 1.6;">Your teacher has enrolled you into the institutional student directory. Please authorize your email to activate your account and generate your secure portal access password.</p>
                
                <div style="background-color: #F0ECE4; border: 1px solid #E5E0D8; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 13px;">
                    <p style="margin: 4px 0;"><b>Enrolled Email:</b> <span style="color: #C84B18; font-family: monospace;">{email}</span></p>
                    {f'<p style="margin: 4px 0;"><b>Roll Number:</b> {roll_number}</p>' if roll_number else ''}
                    <p style="margin: 4px 0;"><b>Status:</b> <span style="color: #D97706; font-weight: 600;">Pending Authorization</span></p>
                </div>
                
                <div style="margin: 28px 0; text-align: center;">
                    <a href="{verify_url}" style="display: inline-block; background-color: #C84B18; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; margin-bottom: 12px;">Authorize Student Account</a>
                    <div style="margin-top: 8px;">
                        <span style="font-size: 12px; color: #716D67;">or authorize instantly with your Google Workspace account:</span>
                    </div>
                    <a href="{verify_url}&provider=google" style="display: inline-block; background-color: #ffffff; color: #374151; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 13px; border: 1px solid #D1D5DB; margin-top: 8px;">
                        Sign in & Authorize with Google
                    </a>
                </div>
                
                <p style="font-size: 12px; color: #716D67; line-height: 1.5;">Once authorized, a unique secure password will automatically be generated and delivered to your inbox for direct email sign-in.</p>
                
                <hr style="border: none; border-top: 1px solid #E5E0D8; margin-top: 28px;" />
                <p style="font-size: 11px; color: #716D67; margin-bottom: 0;">EduQuizX Autonomous Examination System • Verification Request</p>
            </div>
        </body>
        </html>
        """
        
        logger.info(f"📧 [AUTHORIZATION EMAIL] Sent authorization link to {student_name} ({email})")
        print(f"📧 [AUTHORIZATION EMAIL] Sent authorization link to {student_name} ({email}) -> {verify_url}")
        self._send_smtp_email(email, subject, html_content)

    def send_student_credentials_email(self, student_name: str, email: str, password: str):
        """Dispatches generated student portal password after authorization is completed."""
        portal_url = settings.FRONTEND_URL
        subject = "Your EduQuizX Student Portal Password & Credentials"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7F4EF; padding: 24px; color: #242321;">
            <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #E5E0D8;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                    <div style="background-color: #059669; color: #ffffff; padding: 8px 12px; border-radius: 8px; font-weight: bold; font-size: 16px;">Verified</div>
                    <span style="font-size: 12px; color: #716D67;">EduQuizX Student Portal</span>
                </div>

                <h2 style="color: #242321; margin-top: 0; font-size: 20px; font-weight: 700;">Account Authorized Successfully!</h2>
                <p style="font-size: 14px; line-height: 1.6;">Hello <b>{student_name}</b>,</p>
                <p style="font-size: 14px; line-height: 1.6;">Your student account is now fully verified. Your secure student portal password has been generated below:</p>
                
                <div style="background-color: #F0ECE4; border: 1px solid #E5E0D8; border-radius: 8px; padding: 20px; margin: 20px 0; font-size: 14px;">
                    <p style="margin: 6px 0;"><b>Portal Login Email:</b> <span style="color: #C84B18; font-family: monospace; font-size: 15px;">{email}</span></p>
                    <p style="margin: 6px 0;"><b>Generated Password:</b> <span style="color: #047857; font-family: monospace; font-size: 17px; font-weight: bold; background: #ECFDF5; padding: 3px 8px; border-radius: 4px; border: 1px solid #A7F3D0;">{password}</span></p>
                </div>
                
                <p style="font-size: 13px; line-height: 1.6;">You can sign in anytime using your email and generated password, or by clicking <b>"Continue with Google"</b> with your authorized email address:</p>
                
                <div style="margin: 24px 0; text-align: center;">
                    <a href="{portal_url}" style="display: inline-block; background-color: #C84B18; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Sign in to Student Portal</a>
                </div>
                
                <hr style="border: none; border-top: 1px solid #E5E0D8; margin-top: 28px;" />
                <p style="font-size: 11px; color: #716D67; margin-bottom: 0;">EduQuizX Autonomous Examination System • Confidential Access Credentials</p>
            </div>
        </body>
        </html>
        """
        
        logger.info(f"📧 [CREDENTIALS EMAIL] Dispatched generated password to {student_name} ({email}) | Pass: {password}")
        print(f"📧 [CREDENTIALS EMAIL] Dispatched generated password to {student_name} ({email}) | Pass: {password}")
        self._send_smtp_email(email, subject, html_content)
    def send_password_reset_email(self, user_name: str, email: str, reset_token: str):
        """Dispatches a password reset recovery email containing a secure tokenized reset link."""
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"
        subject = "EduQuizX — Password Reset Request"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7F4EF; padding: 24px; color: #242321;">
            <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #E5E0D8;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
                    <div style="background-color: #C84B18; color: #ffffff; padding: 8px 12px; border-radius: 8px; font-weight: bold; font-size: 16px;">EduQuizX</div>
                    <span style="font-size: 12px; color: #716D67;">Password Recovery</span>
                </div>

                <h2 style="color: #242321; margin-top: 0; font-size: 20px; font-weight: 700;">Password Reset Request</h2>
                <p style="font-size: 14px; line-height: 1.6;">Hello <b>{user_name}</b>,</p>
                <p style="font-size: 14px; line-height: 1.6;">We received a request to reset your password. Click the secure button below to set a new password for your account:</p>
                
                <div style="margin: 24px 0; text-align: center;">
                    <a href="{reset_url}" style="display: inline-block; background-color: #C84B18; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Reset Account Password</a>
                </div>
                
                <p style="font-size: 12px; color: #716D67;">Or copy and paste this link in your browser: <br/><span style="font-family: monospace; font-size: 11px; word-break: break-all;">{reset_url}</span></p>
                
                <hr style="border: none; border-top: 1px solid #E5E0D8; margin-top: 28px;" />
                <p style="font-size: 11px; color: #716D67; margin-bottom: 0;">EduQuizX Autonomous Examination System • If you did not request this, please ignore this email.</p>
            </div>
        </body>
        </html>
        """
        
        logger.info(f"📧 [PASSWORD RESET EMAIL] Dispatched reset link token to {user_name} ({email})")
        print(f"📧 [PASSWORD RESET EMAIL] Dispatched reset link token to {user_name} ({email}) | Link: {reset_url}")
        self._send_smtp_email(email, subject, html_content)

    def send_student_welcome_email(self, student_name: str, email: str, password: str, roll_number: Optional[str] = None):
        """Legacy helper maintained for backward compatibility."""
        self.send_student_credentials_email(student_name, email, password)

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
        exam_link = f"{settings.FRONTEND_URL}/exam/{exam_code}"
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

    def send_exam_reminder_email(
        self, 
        student_name: str, 
        email: str, 
        exam_name: str, 
        exam_code: str, 
        username: str, 
        password: str,
        start_time_str: str
    ):
        """Dispatches an automated 15-minute pre-exam schedule reminder email."""
        exam_link = f"{settings.FRONTEND_URL}/exam/{exam_code}"
        subject = f"⏰ 15-Minute Exam Reminder — {exam_name}"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; background-color: #FAF7F2; padding: 20px; color: #1C1917;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 30px; border: 1px solid #E7E0D3;">
                <span style="background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; padding: 4px 12px; border-radius: 99px; font-size: 11px; font-weight: bold; text-transform: uppercase;">Upcoming Exam Starting Soon</span>
                <h2 style="color: #9A3412; margin-top: 10px;">Your Exam Begins in 15 Minutes</h2>
                <p>Hello <b>{student_name}</b>,</p>
                <p>This is an automated schedule reminder that your examination <b>{exam_name}</b> (Code: <b style="color: #9A3412;">{exam_code}</b>) is starting at <b>{start_time_str}</b>.</p>
                
                <div style="background-color: #FBF9F5; border: 1px solid #E7E0D3; border-radius: 12px; padding: 20px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><b>Session Username:</b> <span style="color: #9A3412; font-family: monospace; font-size: 16px;">{username}</span></p>
                    <p style="margin: 5px 0;"><b>Passcode / PIN:</b> <span style="color: #047857; font-family: monospace; font-size: 16px; background: #ECFDF5; padding: 2px 8px; border-radius: 4px;">{password}</span></p>
                </div>
                
                <p>Click below to join the waiting room countdown:</p>
                <p><a href="{exam_link}" style="display: inline-block; background: #9A3412; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: bold;">Open Live Exam Gateway</a></p>
                
                <hr style="border: none; border-top: 1px solid #E7E0D3; margin-top: 30px;" />
                <p style="font-size: 11px; color: #78716C;">EduQuizX Proctoring Portal • Scheduled Window Notification</p>
            </div>
        </body>
        </html>
        """
        
        logger.info(f"⏰ [REMINDER SENT] 15-min reminder sent to {student_name} ({email}) for exam {exam_code}")
        print(f"⏰ [REMINDER SENT] 15-min reminder sent to {student_name} ({email}) for exam {exam_code}")
        self._send_smtp_email(email, subject, html_content)

email_service = EmailService()
