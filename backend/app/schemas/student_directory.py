from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List, Any
from datetime import datetime

class DirectoryStudentCreate(BaseModel):
    name: str
    email: Optional[str] = None
    roll_number: Optional[str] = None
    phone: Optional[str] = None
    student_code: Optional[str] = None
    status: Optional[str] = "active"

class DirectoryStudentUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    roll_number: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = None

class DirectoryStudentResponse(BaseModel):
    id: str
    directory_id: str
    name: str
    email: Optional[str] = None
    roll_number: Optional[str] = None
    phone: Optional[str] = None
    student_code: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class StudentDirectoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    initial_students: Optional[List[DirectoryStudentCreate]] = None

class StudentDirectoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class StudentDirectoryResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    description: Optional[str] = None
    created_by: str
    student_count: Optional[int] = 0
    is_active: bool
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class CSVImportResult(BaseModel):
    imported_count: int
    skipped_count: int
    errors: List[str]

