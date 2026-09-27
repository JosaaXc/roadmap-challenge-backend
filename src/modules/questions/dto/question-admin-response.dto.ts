import { ApiProperty } from '@nestjs/swagger';

/**
 * Admin-only view of the questionnaire: unlike the public
 * `QuestionResponseDto`, options expose `tagsOutput` so the admin
 * panel can read the current inference tags before editing.
 */
export class QuestionOptionAdminResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Frontend (Interfaces y Web)' })
  text!: string;

  @ApiProperty({ type: [String], example: ['frontend'] })
  tagsOutput!: string[];
}

export class QuestionAdminResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '¿En qué área principal te gustaría especializarte?' })
  text!: string;

  @ApiProperty({ example: true })
  isRequired!: boolean;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: 1 })
  order!: number;

  @ApiProperty({ type: [QuestionOptionAdminResponseDto] })
  options!: QuestionOptionAdminResponseDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}
