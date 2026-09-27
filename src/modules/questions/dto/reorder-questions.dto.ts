import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReorderQuestionItemDto {
  @ApiProperty({ format: 'uuid', description: 'Question id to move.' })
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty({ example: 2, minimum: 1, description: 'Final position (1-based).' })
  @IsInt()
  @Min(1)
  newOrder!: number;
}

export class ReorderQuestionsDto {
  @ApiProperty({ type: [ReorderQuestionItemDto] })
  @IsArray()
  @ArrayMinSize(1, { message: 'items must contain at least 1 question' })
  @ValidateNested({ each: true })
  @Type(() => ReorderQuestionItemDto)
  items!: ReorderQuestionItemDto[];
}
