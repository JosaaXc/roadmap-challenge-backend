import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CommunityPathOwnerDto {
  @ApiProperty({ example: 'fernando_h' })
  username!: string;
}

export class CommunityPathDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Ruta Fullstack Node & React' })
  title!: string;

  @ApiPropertyOptional({ type: 'string', nullable: true })
  description!: string | null;

  @ApiProperty({ example: 33.3, description: "Author's progress (social proof, not yours)." })
  progress!: number;

  @ApiProperty({ example: 6, description: 'Alive node count.' })
  nodeCount!: number;

  @ApiProperty({ type: CommunityPathOwnerDto })
  owner!: CommunityPathOwnerDto;

  @ApiProperty({ format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: Date;
}
