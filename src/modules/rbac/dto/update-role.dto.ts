import { PartialType } from '@nestjs/mapped-types';
import { CreateRoleDto } from './create-role.dto.js';

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}
