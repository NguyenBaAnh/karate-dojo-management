import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateClassContentDto } from './dto/create-class-content.dto.js';
import { UpdateClassContentDto } from './dto/update-class-content.dto.js';

type StoredClassContent = { kind: 'CLASS_CONTENT'; title: string; body: string };

@Injectable()
export class ClassContentsService {
  constructor(private readonly prisma: PrismaService) {}

  private encode(title: string, body: string) {
    const stored: StoredClassContent = { kind: 'CLASS_CONTENT', title: title.trim(), body: body.trim() };
    return JSON.stringify(stored);
  }

  private decode(content: string) {
    try {
      const parsed = JSON.parse(content);
      if (parsed?.kind === 'CLASS_CONTENT' && typeof parsed.title === 'string' && typeof parsed.body === 'string') {
        return { title: parsed.title, content: parsed.body };
      }
    } catch {}
    return { title: 'Nội dung lớp học', content };
  }

  async findByClass(classId: string) {
    const karateClass = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!karateClass) throw new NotFoundException('Không tìm thấy lớp học');

    const notes = await this.prisma.learningNote.findMany({
      where: { classId, studentId: null },
      orderBy: { createdAt: 'desc' },
    });

    return notes.map((note) => ({
      id: note.id,
      classId: note.classId,
      teacherId: note.teacherId,
      createdAt: note.createdAt,
      ...this.decode(note.content),
    }));
  }

  async create(classId: string, dto: CreateClassContentDto) {
    const karateClass = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!karateClass) throw new NotFoundException('Không tìm thấy lớp học');

    const note = await this.prisma.learningNote.create({
      data: {
        classId,
        studentId: null,
        teacherId: karateClass.teacherId ?? null,
        content: this.encode(dto.title, dto.content),
      },
    });

    return { id: note.id, classId, teacherId: note.teacherId, createdAt: note.createdAt, title: dto.title.trim(), content: dto.content.trim() };
  }

  async update(id: string, dto: UpdateClassContentDto) {
    const current = await this.prisma.learningNote.findUnique({ where: { id } });
    if (!current || !current.classId || current.studentId) {
      throw new NotFoundException('Không tìm thấy nội dung lớp học');
    }

    const note = await this.prisma.learningNote.update({
      where: { id },
      data: { content: this.encode(dto.title, dto.content) },
    });

    return { id: note.id, classId: note.classId, teacherId: note.teacherId, createdAt: note.createdAt, title: dto.title.trim(), content: dto.content.trim() };
  }

  async remove(id: string) {
    const current = await this.prisma.learningNote.findUnique({ where: { id } });
    if (!current || !current.classId || current.studentId) {
      throw new NotFoundException('Không tìm thấy nội dung lớp học');
    }
    await this.prisma.learningNote.delete({ where: { id } });
    return { message: 'Đã xóa nội dung lớp học' };
  }
}
