import type { Paginator } from "@smithy/types";
import { ListAutomatedReasoningPolicyTestCasesCommandInput, ListAutomatedReasoningPolicyTestCasesCommandOutput } from "../commands/ListAutomatedReasoningPolicyTestCasesCommand";
import { BedrockPaginationConfiguration } from "./Interfaces";
/**
 * @public
 */
export declare const paginateListAutomatedReasoningPolicyTestCases: (config: BedrockPaginationConfiguration, input: ListAutomatedReasoningPolicyTestCasesCommandInput, ...rest: any[]) => Paginator<ListAutomatedReasoningPolicyTestCasesCommandOutput>;
