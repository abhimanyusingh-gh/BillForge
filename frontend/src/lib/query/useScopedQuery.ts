import {
  useMutation,
  useQuery,
  type QueryKey,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult
} from "@tanstack/react-query";
import { useActiveClientOrg } from "@/hooks/useActiveClientOrg";

const SCOPED_QUERY_NAMESPACE = "clientOrg" as const;

export type ScopedQueryKey = readonly unknown[];

export interface ScopedQueryContext {
  activeClientOrgId: string;
}

export interface UseScopedQueryOptions<TData, TError>
  extends Omit<UseQueryOptions<TData, TError, TData, QueryKey>, "queryKey" | "queryFn" | "enabled"> {
  queryKey: ScopedQueryKey;
  queryFn: (ctx: ScopedQueryContext) => Promise<TData>;
  enabled?: boolean;
}

export function useScopedQuery<TData, TError = Error>(
  options: UseScopedQueryOptions<TData, TError>
): UseQueryResult<TData, TError> {
  const { activeClientOrgId } = useActiveClientOrg();
  const { queryKey, queryFn, enabled = true, ...rest } = options;
  return useQuery<TData, TError, TData, QueryKey>({
    ...rest,
    queryKey: [SCOPED_QUERY_NAMESPACE, activeClientOrgId, ...queryKey],
    queryFn: () => {
      if (activeClientOrgId === null) {
        return Promise.reject(new Error("No active clientOrgId — useScopedQuery should be disabled"));
      }
      return queryFn({ activeClientOrgId });
    },
    enabled: enabled && activeClientOrgId !== null
  });
}

export interface UseScopedMutationOptions<TData, TError, TVariables>
  extends Omit<UseMutationOptions<TData, TError, TVariables>, "mutationFn"> {
  mutationFn: (ctx: ScopedQueryContext, variables: TVariables) => Promise<TData>;
}

export function useScopedMutation<TData, TError = Error, TVariables = void>(
  options: UseScopedMutationOptions<TData, TError, TVariables>
): UseMutationResult<TData, TError, TVariables> {
  const { activeClientOrgId } = useActiveClientOrg();
  const { mutationFn, ...rest } = options;
  return useMutation<TData, TError, TVariables>({
    ...rest,
    mutationFn: (variables) => {
      if (activeClientOrgId === null) {
        return Promise.reject(new Error("No active clientOrgId — useScopedMutation cannot run"));
      }
      return mutationFn({ activeClientOrgId }, variables);
    }
  });
}
