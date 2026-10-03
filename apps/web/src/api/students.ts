import {
    apiDelete,
    apiGet,
    apiPatch,
    apiPost,
  } from './api';
  
  import type {
    Student,
    StudentsResponse,
  } from '../types/student';
  
  export interface CreateStudentData {
    fullName: string;
    dateOfBirth?: string;
    gender?: string;
    phone?: string;
    email?: string;
    address?: string;
    beltLevel?: string;
    note?: string;
    branchId: string;
  }
  
  export function getStudents(
    search = '',
    page = 1,
    limit = 20,
  ) {
    const params = new URLSearchParams();
  
    if (search) {
      params.set('search', search);
    }
  
    params.set('page', String(page));
    params.set('limit', String(limit));
  
    return apiGet<StudentsResponse>(
      `/students?${params.toString()}`,
    );
  }
  
  export function getStudent(id: string) {
    return apiGet<Student>(`/students/${id}`);
  }
  
  export function createStudent(
    data: CreateStudentData,
  ) {
    return apiPost<Student>('/students', data);
  }
  
  export function updateStudent(
    id: string,
    data: Partial<CreateStudentData>,
  ) {
    return apiPatch<Student>(
      `/students/${id}`,
      data,
    );
  }
  
  export function deleteStudent(id: string) {
    return apiDelete<{ message: string }>(
      `/students/${id}`,
    );
  }