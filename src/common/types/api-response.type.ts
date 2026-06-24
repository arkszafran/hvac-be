export type ApiSuccessResponse<TData = null> = {
  success: true;
  data: TData;
};

export type ApiErrorResponse<TDetails = null> = {
  success: false;
  error: {
    code: string;
    message: string;
    details: TDetails;
  };
};

export type ApiResponse<TData = null, TDetails = null> =
  | ApiSuccessResponse<TData>
  | ApiErrorResponse<TDetails>;

export function apiSuccess<TData = null>(
  data: TData = null as TData,
): ApiSuccessResponse<TData> {
  return {
    success: true,
    data,
  };
}

export function apiError<TDetails = null>(input: {
  code: string;
  message: string;
  details?: TDetails;
}): ApiErrorResponse<TDetails | null> {
  return {
    success: false,
    error: {
      code: input.code,
      message: input.message,
      details: input.details ?? null,
    },
  };
}
