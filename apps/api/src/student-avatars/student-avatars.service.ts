import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class StudentAvatarsService {
  private readonly uploadDir = join(process.cwd(), 'uploads', 'student-avatars');

  constructor(private readonly prisma: PrismaService) {
    mkdirSync(this.uploadDir, { recursive: true });
  }

  private getStudentFile(studentId: string) {
    if (!existsSync(this.uploadDir)) return null;
    const file = readdirSync(this.uploadDir).find((name) => name.startsWith(`${studentId}.`));
    return file ? join(this.uploadDir, file) : null;
  }

  private mimeFromFile(file: string) {
    if (file.endsWith('.png')) return 'image/png';
    if (file.endsWith('.webp')) return 'image/webp';
    return 'image/jpeg';
  }

  async save(studentId: string, dataUrl: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, deletedAt: null },
    });
    if (!student) throw new NotFoundException('Không tìm thấy học viên');

    const match = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/s);
    if (!match) throw new BadRequestException('Ảnh phải là JPEG, PNG hoặc WEBP');

    const mime = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 4 * 1024 * 1024) {
      throw new BadRequestException('Ảnh đại diện không được lớn hơn 4 MB');
    }

    const oldFile = this.getStudentFile(studentId);
    if (oldFile && existsSync(oldFile)) rmSync(oldFile);

    const extension = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const filePath = join(this.uploadDir, `${studentId}.${extension}`);
    writeFileSync(filePath, buffer);

    return { studentId, url: `/api/student-avatars/${studentId}`, updatedAt: new Date().toISOString() };
  }

  async get(studentId: string) {
    const file = this.getStudentFile(studentId);
    if (!file || !existsSync(file)) throw new NotFoundException('Học viên chưa có ảnh đại diện');
    return {
      stream: new StreamableFile(createReadStream(file)),
      contentType: this.mimeFromFile(file),
    };
  }

  remove(studentId: string) {
    const file = this.getStudentFile(studentId);
    if (file && existsSync(file)) rmSync(file);
    return { message: 'Đã xóa ảnh đại diện' };
  }
}
