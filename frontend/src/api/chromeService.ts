import { ApiError, apiClient } from "@/api/client";
import { chromeUrls } from "@/api/chromeUrls";

interface CountResponse {
  total?: number;
}

function readTotal(response: CountResponse | null | undefined): number {
  const total = response?.total;
  return typeof total === "number" && Number.isFinite(total) && total >= 0 ? total : 0;
}

async function fetchActionRequiredCount(signal?: AbortSignal): Promise<number> {
  const response = await apiClient.get<CountResponse>(chromeUrls.actionRequiredCount(), { signal });
  return readTotal(response);
}

async function fetchTriageCount(signal?: AbortSignal): Promise<number> {
  try {
    const response = await apiClient.get<CountResponse>(chromeUrls.triageCount(), { signal });
    return readTotal(response);
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 403) {
      return 0;
    }
    throw caught;
  }
}

export const chromeService = {
  fetchActionRequiredCount,
  fetchTriageCount
};
