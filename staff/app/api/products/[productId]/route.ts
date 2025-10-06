import { NextResponse } from 'next/server';

import { PRODUCTS } from '../data';

const toTraceId = () =>
  `trace_${Math.random().toString(16).slice(2, 10)}${Date.now().toString(16)}`;

interface RouteContext {
  params: { productId: string };
}

export function GET(_: Request, context: RouteContext) {
  const product = PRODUCTS.find((item) => item.id === context.params.productId);

  if (!product) {
    const traceId = toTraceId();
    const response = NextResponse.json(
      {
        errors: [
          {
            code: 'not_found',
            title: 'Продукт не найден',
            detail: `Продукт с идентификатором ${context.params.productId} отсутствует в каталоге`,
          },
        ],
        trace_id: traceId,
      },
      { status: 404 }
    );

    response.headers.set('x-trace-id', traceId);
    return response;
  }

  const traceId = toTraceId();
  const response = NextResponse.json(
    {
      data: product,
      trace_id: traceId,
    },
    { status: 200 }
  );

  response.headers.set('x-trace-id', traceId);

  return response;
}
