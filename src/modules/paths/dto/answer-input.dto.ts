import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AnswerInputDto {
  @ApiProperty({ description: 'Answered question id (must be active).', example: 'q1-role' })
  @IsString()
  questionId!: string;

  @ApiProperty({
    description: 'Selected option id (must belong to the question). Get ids from GET /questions.',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @IsString()
  optionId!: string;
}
