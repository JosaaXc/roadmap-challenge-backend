import { SetMetadata } from '@nestjs/common';

export const SKIP_REQUIRED_HEADERS_KEY = 'skipRequiredHeaders';

export const SkipRequiredHeaders = () => SetMetadata(SKIP_REQUIRED_HEADERS_KEY, true);
