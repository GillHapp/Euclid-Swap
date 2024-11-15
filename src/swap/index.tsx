"use client";

import {
    CodegenGeneratedRouterSimulateSwapDocument,
    useCodegenGeneratedRouterAllTokensQuery,
    useCodegenGeneratedRouterSimulateSwapQuery,
    useCodegenGeneratedTokenTokenMetadataByIdQuery,
} from "@euclidprotocol/graphql-codegen/dist/src/react";
import React, { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui/button";
import Token from "../components/token";
import { ChevronDown } from "lucide-react";
import { useTokenSelectorModalStore } from "../modals/token-selector/state";
import { Input } from "../components/ui/input";
import { convertMacroToMicro, convertMicroToMacro } from "@andromedaprotocol/andromeda.js";
import { useGetRoutes } from "../hooks/rest/useGetRoutes";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../components/ui/select";
import PromiseButton from "../components/PromiseButton";
import { DenomSelector } from "../components/DenomSelector";
import { BalanceValue } from "../components/DenomBalance";
import { ITokenType } from "@euclidprotocol/graphql-codegen";
import { useWalletStore } from "../zustand/wallet";
import { useWalletModalStore } from "../modals/wallet/state";
import { useExecuteSwap } from "../hooks/rest/useExecuteSwap";
import { toast } from "sonner";
import { gqlClient } from "@/lib/gql/client";
import reactQueryClient from "@/lib/react-query/client";

export default function Swap() {
    const { chain } = useWalletStore();
    const { onModalStateChange } = useWalletModalStore();
    const [fromToken, setFromToken] = useState<string>("");
    const [fromTokenAmount, setFromTokenAmount] = useState<string>("");
    const [toToken, setToToken] = useState<string>("");

    const [selectedFromDenom, setSelectedFromDenom] = useState<ITokenType>({ voucher: {} });

    useEffect(() => {
        setSelectedFromDenom({ voucher: {} });
    }, [fromToken])

    const [route, setRoute] = useState<string[]>([]);

    const { onOpenModal } = useTokenSelectorModalStore();

    const { data: tokens, loading } = useCodegenGeneratedRouterAllTokensQuery();

    const { data: fromTokenMetadata } =
        useCodegenGeneratedTokenTokenMetadataByIdQuery({
            variables: {
                token_token_metadata_by_id_token_id: fromToken || "",
            },
            skip: !fromToken,
        });

    const { data: toTokenMetadata } =
        useCodegenGeneratedTokenTokenMetadataByIdQuery({
            variables: {
                token_token_metadata_by_id_token_id: toToken || "",
            },
            skip: !toToken,
        });

    const microFromValue = useMemo(() => {
        return convertMacroToMicro(fromTokenAmount, fromTokenMetadata?.token.token_metadata_by_id.coinDecimal ?? 6).split(".")[0]
    }, [fromTokenAmount, fromTokenMetadata])

    const { data: routes, isLoading: routesLoading } = useGetRoutes({
        tokenIn: fromToken,
        tokenOut: toToken,
        amountIn: microFromValue
    })

    useEffect(() => {
        if (routes && routes.paths && routes.paths.length > 0) {
            setRoute(routes.paths[0]?.route || [])
        } else {
            setRoute([])
        }
    }, [routes])

    const { data: simulateSwapResult } = useCodegenGeneratedRouterSimulateSwapQuery({
        variables: {
            router_simulate_swap_amount_in: microFromValue,
            router_simulate_swap_asset_in: fromToken || "",
            router_simulate_swap_asset_out: toToken || "",
            router_simulate_swap_min_amount_out: "1",
            router_simulate_swap_swaps: route ?? [],
        },
        skip: !fromToken || !toToken || microFromValue === "0" || !route,
    });

    const macroAmountOut = useMemo(() => {
        return convertMicroToMacro(simulateSwapResult?.router.simulate_swap.amount_out ?? "0", toTokenMetadata?.token.token_metadata_by_id.coinDecimal ?? 6)
    }, [simulateSwapResult, toTokenMetadata])

    const { mutateAsync: executeSwap, isPending } = useExecuteSwap();

    const handleSwap = async () => {
        try {
            const tx = await executeSwap({
                amountIn: microFromValue,
                assetIn: {
                    token: fromToken!,
                    token_type: selectedFromDenom!,
                },
                assetOut: toToken || "",
                crossChainAddresses: [],
                minAmountOut: "1",
                swaps: route || [],
                timeout: 600,
            });
            console.log("this is a transaction", tx)
            await gqlClient.refetchQueries({
                'include': [CodegenGeneratedRouterSimulateSwapDocument]
            });
            await reactQueryClient.invalidateQueries({
                queryKey: ["rest", "routes"]
            });
            console.log("Swap successful:", tx.transactionHash);
        } catch (error) {
            toast.error(`Swap failed: ${error.message}`);
            console.error("Swap failed:", error);
        }
    }

    // const handleSwap = async () => {
    //     try {
    //         // Simulate the swap
    //         const simulateResponse = await fetch("https://testnet.api.euclidprotocol.com/api/v1/simulate-swap", {
    //             method: "POST",
    //             headers: {
    //                 "Content-Type": "application/json",
    //                 Accept: "application/json",
    //             },
    //             body: JSON.stringify({
    //                 "amount_in": "10",
    //                 "asset_in": "fundenom",
    //                 "asset_out": "nibi",
    //                 "contract": "nibi1vndyr364cmexy3qq8zx4x2v757purq4flt9mj4qe3z2s2wn29v5sdfc830",
    //                 "min_amount_out": "1",
    //                 "swaps": ["fundenom", "nibi"]
    //             }),
    //         });

    //         if (!simulateResponse.ok) {
    //             const errorBody = await simulateResponse.text();
    //             throw new Error(`Simulate Swap API call failed: ${errorBody}`);
    //         }

    //         const simulateResult = await simulateResponse.json();
    //         console.log("Simulated Swap Result:", simulateResult);

    //         // Execute the swap
    //         const tx = await executeSwap({
    //             amountIn: microFromValue,
    //             assetIn: {
    //                 token: fromToken!,
    //                 token_type: selectedFromDenom!,
    //             },
    //             assetOut: toToken!,
    //             crossChainAddresses: [],
    //             minAmountOut: "1",
    //             swaps: route || [],
    //             timeout: 600,
    //         });

    //         // Refresh data after a successful swap
    //         await gqlClient.refetchQueries({
    //             include: [CodegenGeneratedRouterSimulateSwapDocument],
    //         });

    //         await reactQueryClient.invalidateQueries({
    //             queryKey: ["rest", "routes"],
    //         });

    //         console.log("Swap successful:", tx.transactionHash);
    //     } catch (error) {
    //         // Display error in toast and log to console
    //         toast.error(`Swap failed: ${error.message}`);
    //         console.error("Swap failed:", error);
    //     }
    // };



    return (
        <div className="flex flex-col items-center mt-10 gap-6 w-lg border border-slate-800 rounded-lg p-4">
            <div className="flex flex-col gap-6 w-full">
                {/* From Token Selection */}
                {(fromToken && chain) && (
                    <div className="flex flex-col items-start w-full">
                        <BalanceValue
                            tokenId={fromToken}
                            selectedDenom={selectedFromDenom}
                        />
                        <DenomSelector
                            selectedDenom={selectedFromDenom}
                            chainUId={chain?.chain_uid ?? ""}
                            tokenId={fromToken}
                            setSelectedDenom={(d) => setSelectedFromDenom(d ?? { voucher: {} })}
                        />
                    </div>
                )}

                {/* From Token Button */}
                <Button
                    onClick={() =>
                        onOpenModal({
                            tokens: tokens?.router.all_tokens.tokens ?? [],
                            title: "From",
                            description: "Select the token you want to swap",
                            onTokenSelect: (token) => {
                                setFromToken(token);
                            },
                        })
                    }
                    disabled={loading}
                    size='lg'
                    variant="secondary"
                >
                    {fromToken ? (
                        <div className="flex flex-row items-center gap-x-2">
                            <Token token={fromToken} />
                            <ChevronDown className="h-4 w-4" />
                        </div>
                    ) : (
                        "From"
                    )}
                </Button>

                {/* From Token Amount Input */}
                <Input
                    value={fromTokenAmount}
                    onChange={(e) => setFromTokenAmount(e.target.value)}
                    placeholder="0.00"
                    className="text-lg h-10"
                />

                {/* To Token Button */}
                <Button
                    onClick={() =>
                        onOpenModal({
                            tokens: tokens?.router.all_tokens.tokens ?? [],
                            title: "To",
                            description: "Select the token you want to receive",
                            onTokenSelect: (token) => {
                                setToToken(token);
                            },
                        })
                    }
                    disabled={loading}
                    size='lg'
                    variant="secondary"
                >
                    {toToken ? (
                        <div className="flex flex-row items-center gap-x-2">
                            <Token token={toToken} />
                            <ChevronDown className="h-4 w-4" />
                        </div>
                    ) : (
                        "To"
                    )}
                </Button>

                {/* To Token Amount (Output) */}
                <Input
                    value={macroAmountOut}
                    placeholder="0.00"
                    className="text-lg h-10"
                    readOnly
                    disabled
                />
            </div>

            <div className="h-[1px] bg-slate-800 w-full" />

            <div className="flex flex-row gap-5 items-center">
                <p>Select Route</p>
                {routesLoading ? "Loading Routes" : routes?.paths?.length === 0 ? "No Routes Found" : (
                    <Select value={route.join("/")} onValueChange={(r) => setRoute(r.split('/'))}>
                        <SelectTrigger className="w-[180px]">
                            {route.length > 0 ? (
                                <div className="flex flex-row items-center gap-x-2">
                                    {route.join(" → ")}
                                </div>
                            ) : "Select Route"}
                        </SelectTrigger>
                        <SelectContent>
                            {routes?.paths?.map((path) => (
                                <SelectItem key={path.route.join("/")} value={path.route.join("/")}>
                                    <div className="flex flex-row items-center gap-x-2">
                                        {path.route.join(" → ")}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {chain ? (
                <PromiseButton disabled={isPending || !fromToken || !toToken || microFromValue === "0" || !route} onClick={handleSwap} className="w-full"> Swap</PromiseButton>
            ) : (
                <Button className="w-full" onClick={() => onModalStateChange(true)}>Connect Chain</Button>
            )}
        </div>
    );
}
