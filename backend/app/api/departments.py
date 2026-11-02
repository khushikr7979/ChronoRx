"""
ChronoRx Hospital Departments Endpoints
Provides the reference catalog of all 29 hospital departments
across 5 official clinical categories, with search and validation.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.schemas.schemas import DepartmentItem, DepartmentCategoryGroup
from app.services.department_service import (
    get_all_departments,
    get_department_by_id,
    get_department_categories,
    search_departments,
    validate_department,
)

router = APIRouter(prefix="/departments", tags=["Hospital Departments"])


@router.get("", response_model=List[DepartmentItem])
def list_departments(
    search: Optional[str] = Query(None, description="Case-insensitive search query (name, category, or keywords e.g. 'heart')"),
    category: Optional[str] = Query(None, description="Filter by category name (e.g. 'Core Specialties')"),
):
    """
    Returns all 29 hospital departments, with optional partial or full-name search
    and category filtering.
    """
    if search or category:
        return search_departments(query=search or "", category=category)
    return get_all_departments()


@router.get("/categories", response_model=List[DepartmentCategoryGroup])
def list_department_categories():
    """
    Returns the 5 clinical department categories with their department rosters.
    """
    return get_department_categories()


@router.get("/{dept_id}", response_model=DepartmentItem)
def get_department_detail(dept_id: str):
    """
    Retrieves details for a single hospital department by its stable ID.
    """
    dept = get_department_by_id(dept_id)
    if not dept:
        # Also check validation by name
        is_valid, _, dept_obj = validate_department(dept_id)
        if is_valid and dept_obj:
            return dept_obj
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Hospital department '{dept_id}' not found.",
        )
    return dept
