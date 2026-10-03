import { Injectable } from '@nestjs/common';

type AttendanceState = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

@Injectable()
export class FeaturesService {
  private students = [
    { id: 'st-001', code: 'HV001', name: 'Nguyễn Minh Anh', className: 'Karate Thiếu nhi A', belt: 'Đai vàng', status: 'ACTIVE', debt: 0, consecutiveAbsences: 0 },
    { id: 'st-002', code: 'HV002', name: 'Trần Gia Huy', className: 'Karate Thiếu nhi A', belt: 'Đai trắng', status: 'ACTIVE', debt: 450000, consecutiveAbsences: 3 },
    { id: 'st-003', code: 'HV003', name: 'Lê Hoàng Nam', className: 'Karate Căn bản B', belt: 'Đai cam', status: 'ACTIVE', debt: 200000, consecutiveAbsences: 1 },
    { id: 'st-004', code: 'HV004', name: 'Phạm Khánh Linh', className: 'Karate Căn bản B', belt: 'Đai xanh', status: 'PAUSED', debt: 0, consecutiveAbsences: 0 },
    { id: 'st-005', code: 'HV005', name: 'Võ Đức Anh', className: 'Karate Nâng cao', belt: 'Đai nâu', status: 'ACTIVE', debt: 650000, consecutiveAbsences: 2 },
  ];

  private attendance: Record<string, AttendanceState> = {
    'st-001': 'PRESENT',
    'st-002': 'ABSENT',
    'st-003': 'PRESENT',
    'st-004': 'EXCUSED',
    'st-005': 'LATE',
  };

  dashboard() {
    const debt = this.students.reduce((sum, student) => sum + student.debt, 0);
    return {
      summary: {
        activeStudents: this.students.filter((x) => x.status === 'ACTIVE').length,
        todayClasses: 4,
        attendanceRate: 86,
        outstandingDebt: debt,
        monthlyIncome: 28650000,
        monthlyExpense: 8950000,
      },
      alerts: [
        { level: 'danger', title: 'Nghỉ học liên tiếp', detail: 'Trần Gia Huy đã nghỉ 3 buổi liên tiếp.' },
        { level: 'warning', title: 'Học phí trễ hạn', detail: '3 học viên đang có công nợ cần nhắc.' },
        { level: 'info', title: 'Lớp sắp bắt đầu', detail: 'Karate Thiếu nhi A bắt đầu lúc 17:30.' },
      ],
      revenue: [18.2, 21.4, 19.8, 25.6, 23.1, 28.65],
    };
  }

  listStudents() {
    return this.students;
  }

  listClasses() {
    return [
      { id: 'cl-001', code: 'TN-A', name: 'Karate Thiếu nhi A', teacher: 'Sensei Hoàng', schedule: 'T2 - T4 - T6, 17:30', students: 18, capacity: 25 },
      { id: 'cl-002', code: 'CB-B', name: 'Karate Căn bản B', teacher: 'Sensei Minh', schedule: 'T3 - T5 - T7, 18:30', students: 15, capacity: 22 },
      { id: 'cl-003', code: 'NC', name: 'Karate Nâng cao', teacher: 'Sensei Hoàng', schedule: 'T3 - T5, 19:45', students: 12, capacity: 18 },
    ];
  }

  todayAttendance() {
    return this.students.map((student) => ({
      ...student,
      attendance: this.attendance[student.id] ?? 'PRESENT',
    }));
  }

  checkAttendance(studentId: string, status: AttendanceState) {
    if (!this.students.some((item) => item.id === studentId)) {
      return { ok: false, message: 'Không tìm thấy học viên' };
    }
    this.attendance[studentId] = status;
    return { ok: true, studentId, status };
  }

  tuition() {
    return this.students.map((student, index) => {
      const sessions = [9, 7, 8, 0, 10][index] ?? 0;
      const price = [70000, 70000, 65000, 65000, 85000][index] ?? 70000;
      const total = sessions * price;
      return {
        id: `inv-${index + 1}`,
        studentId: student.id,
        student: student.name,
        sessions,
        pricePerSession: price,
        total,
        debt: student.debt,
        dueDate: '2026-09-10',
        status: student.debt > 0 ? 'UNPAID' : 'PAID',
      };
    });
  }

  finance() {
    return {
      income: 28650000,
      expense: 8950000,
      net: 19700000,
      recent: [
        { type: 'INCOME', category: 'Học phí', amount: 630000, note: 'HV001 - học phí tháng 09' },
        { type: 'EXPENSE', category: 'Dụng cụ', amount: 1200000, note: 'Mua 20 đích đá tập luyện' },
        { type: 'INCOME', category: 'Bán hàng', amount: 450000, note: 'Bán võ phục + đai' },
      ],
    };
  }

  reports() {
    return {
      absenceRisk: this.students.filter((student) => student.consecutiveAbsences >= 2),
      overdue: this.students.filter((student) => student.debt > 0),
      attendanceByClass: [
        { className: 'Karate Thiếu nhi A', present: 16, total: 18 },
        { className: 'Karate Căn bản B', present: 13, total: 15 },
        { className: 'Karate Nâng cao', present: 11, total: 12 },
      ],
    };
  }
}
