export interface Branch {
    id: string;
    code: string;
    name: string;
    address?: string | null;
    phone?: string | null;
  }
  
  export interface Student {
    id: string;
    code: string;
    fullName: string;
    dateOfBirth?: string | null;
    gender?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
  
    joinedAt: string;
  
    status: string;
  
    beltLevel?: string | null;
    note?: string | null;
  
    consecutiveAbsences: number;
  
    branchId: string;
    branch?: Branch;
  
    createdAt: string;
    updatedAt: string;
  }
  
  export interface StudentsResponse {
    data: Student[];
  
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }