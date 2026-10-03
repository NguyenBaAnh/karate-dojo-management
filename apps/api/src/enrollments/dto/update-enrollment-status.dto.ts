import { IsIn } from 'class-validator';

export class UpdateEnrollmentStatusDto {
  @IsIn([
    'ACTIVE',
    'PAUSED',
    'COMPLETED',
    'CANCELLED',
  ])
  status!:
    | 'ACTIVE'
    | 'PAUSED'
    | 'COMPLETED'
    | 'CANCELLED';
}