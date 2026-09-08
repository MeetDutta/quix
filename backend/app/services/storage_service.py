import os
import logging
from typing import Optional, Tuple
from fastapi import HTTPException
from app.config import settings

logger = logging.getLogger(__name__)

# Allowed MIME types and binary magic signatures
MAGIC_SIGNATURES = {
    "pdf": [b"%PDF-"],
    "docx": [b"PK\x03\x04"],
}
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".csv"}
MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024  # 15 Megabytes

class StorageService:
    def __init__(self):
        # Allow configurable persistent volume mount path for Render (e.g. /var/data or settings.UPLOAD_DIR)
        self.base_storage_dir = os.getenv("STORAGE_PATH", settings.UPLOAD_DIR)
        os.makedirs(self.base_storage_dir, exist_ok=True)
        os.makedirs(os.path.join(self.base_storage_dir, "kb_documents"), exist_ok=True)

    def validate_file(self, filename: str, content: bytes) -> Tuple[str, str]:
        """
        Performs strict security checks:
        1. Non-empty check and maximum file size enforcement.
        2. Extension whitelisting.
        3. Magic byte signature verification against spoofed extensions.
        """
        if not content or len(content) == 0:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")

        if len(content) > MAX_FILE_SIZE_BYTES:
            max_mb = MAX_FILE_SIZE_BYTES // (1024 * 1024)
            raise HTTPException(
                status_code=400,
                detail=f"File exceeds maximum allowed size of {max_mb}MB"
            )

        safe_name = os.path.basename(filename).strip()
        ext = os.path.splitext(safe_name)[1].lower()

        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file format '{ext}'. Supported formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            )

        # Magic byte verification
        if ext == ".pdf":
            if not any(content.startswith(sig) for sig in MAGIC_SIGNATURES["pdf"]):
                raise HTTPException(status_code=400, detail="Invalid PDF file: Corrupt or spoofed header")
        elif ext == ".docx":
            if not any(content.startswith(sig) for sig in MAGIC_SIGNATURES["docx"]):
                raise HTTPException(status_code=400, detail="Invalid DOCX file: Corrupt or spoofed header")
        elif ext in [".txt", ".csv"]:
            # Ensure text file does not contain embedded null bytes (common in binary executables)
            if b"\x00" in content[:2048]:
                raise HTTPException(status_code=400, detail="Invalid text document: Binary data detected")

        return safe_name, ext

    def save_kb_document(self, subject_id: Optional[str], filename: str, content: bytes) -> str:
        """
        Saves document content to the isolated storage path and returns the resolved file path.
        """
        safe_name, _ = self.validate_file(filename, content)
        
        subject_folder = subject_id.replace(" ", "_").lower() if subject_id else "general"
        target_dir = os.path.join(self.base_storage_dir, "kb_documents", subject_folder)
        os.makedirs(target_dir, exist_ok=True)
        
        file_path = os.path.join(target_dir, safe_name)
        with open(file_path, "wb") as f:
            f.write(content)
            
        logger.info(f"Stored document '{safe_name}' ({len(content)} bytes) at '{file_path}'")
        return file_path

    def file_exists(self, file_path: Optional[str]) -> bool:
        """Checks whether the given storage path exists safely within storage bounds."""
        if not file_path:
            return False
        # Prevent traversal outside base_storage_dir
        real_path = os.path.realpath(file_path)
        real_base = os.path.realpath(self.base_storage_dir)
        if not real_path.startswith(real_base):
            return False
        return os.path.exists(real_path)

    def get_verified_path(self, file_path: Optional[str]) -> str:
        """Validates path boundary and existence, raising 404 if missing."""
        if not self.file_exists(file_path):
            raise HTTPException(status_code=404, detail="Document file not found on server storage")
        return os.path.realpath(file_path)

    def delete_document(self, file_path: str) -> bool:
        """Removes document from persistent storage if it exists."""
        try:
            if file_path and self.file_exists(file_path):
                os.remove(os.path.realpath(file_path))
                return True
        except Exception as e:
            logger.error(f"Error removing file '{file_path}': {e}")
        return False

storage_service = StorageService()
