import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { randomUUID } from 'crypto';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const traceId = req.headers['x-trace-id'] ?? randomUUID();
    req.traceId = traceId;
    const start = Date.now();
    const { method, url } = req;

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          this.logger.log(
            JSON.stringify({ traceId, method, url, status: 'ok', ms, userId: req.user?.userId }),
          );
        },
        error: (err) => {
          const ms = Date.now() - start;
          const detail = typeof err.getResponse === 'function' ? err.getResponse() : undefined;
          this.logger.error(
            JSON.stringify({ traceId, method, url, status: 'error', ms, error: err.message, detail }),
          );
        },
      }),
    );
  }
}
