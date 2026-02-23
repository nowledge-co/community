import type { Paginator } from "@smithy/types";
import { ListModelImportJobsCommandInput, ListModelImportJobsCommandOutput } from "../commands/ListModelImportJobsCommand";
import { BedrockPaginationConfiguration } from "./Interfaces";
/**
 * @public
 */
export declare const paginateListModelImportJobs: (config: BedrockPaginationConfiguration, input: ListModelImportJobsCommandInput, ...rest: any[]) => Paginator<ListModelImportJobsCommandOutput>;
