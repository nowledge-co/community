import type { Paginator } from "@smithy/types";
import { ListModelInvocationJobsCommandInput, ListModelInvocationJobsCommandOutput } from "../commands/ListModelInvocationJobsCommand";
import { BedrockPaginationConfiguration } from "./Interfaces";
/**
 * @public
 */
export declare const paginateListModelInvocationJobs: (config: BedrockPaginationConfiguration, input: ListModelInvocationJobsCommandInput, ...rest: any[]) => Paginator<ListModelInvocationJobsCommandOutput>;
