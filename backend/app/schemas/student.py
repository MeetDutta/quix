from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional, List

class StudentCreate(BaseModel):
    email: EmailStr
    full_name: str
    roll_number: str
    department_id: Optional[str] = None
    division: Optional[str] = None
    batch: Optional[str] = None

class StudentResponse(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    roll_number: str
    department_name: Optional[str] = None
    division: Optional[str] = None
    batch: Optional[str] = None
    status: str
    is_verified: bool = True
    verification_token: Optional[str] = None
    verification_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class InstitutionResponse(BaseModel):
    id: str
    name: str
    subscription_status: str

    model_config = ConfigDict(from_attributes=True)


class DepartmentCreate(BaseModel):
    name: str
    institution_id: str

class CourseCreate(BaseModel):
    name: str
    department_id: str

class SubjectCreate(BaseModel):
    name: str
    course_id: str
