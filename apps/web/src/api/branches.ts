import { apiGet } from './api';

import type { Branch } from '../types/student';

export function getBranches() {
  return apiGet<Branch[]>('/branches');
}