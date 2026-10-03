import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      service: 'Karate Dojo Management API',
      version: '0.1.0',
      now: new Date().toISOString(),
    };
  }
}
