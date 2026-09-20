import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateCustomNodeDto {
  @ApiProperty({ example: 'MDN: JavaScript asíncrono', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title!: string;

  @ApiProperty({ example: 'https://developer.mozilla.org/es/docs/Web/JavaScript' })
  @IsUrl()
  url!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Existing node in the SAME path to link from (edge is optional).',
  })
  @IsOptional()
  @IsString()
  previousNodeId?: string;
}
