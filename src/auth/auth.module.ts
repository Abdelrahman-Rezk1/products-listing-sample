
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ],
  controllers: [],
  providers: [],
  exports: [],
})
export class AuthModule {}
