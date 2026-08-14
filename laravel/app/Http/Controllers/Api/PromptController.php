<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PromptRequest;
use App\Models\Prompt;
use Illuminate\Http\JsonResponse;

class PromptController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            Prompt::with('category:id,name,color')
                ->orderByDesc('created_at')
                ->get()
        );
    }

    public function store(PromptRequest $request): JsonResponse
    {
        $prompt = Prompt::create($request->validated());

        return response()->json($prompt->load('category:id,name,color'), 201);
    }

    public function update(PromptRequest $request, Prompt $prompt): JsonResponse
    {
        $prompt->update($request->validated());

        return response()->json($prompt->fresh()->load('category:id,name,color'));
    }

    public function destroy(Prompt $prompt): JsonResponse
    {
        $prompt->delete();

        return response()->json(['message' => 'Prompt supprimé.']);
    }

    public function toggleFavorite(Prompt $prompt): JsonResponse
    {
        $prompt->update(['is_favorite' => ! $prompt->is_favorite]);

        return response()->json(['is_favorite' => $prompt->is_favorite]);
    }

    public function incrementUsage(Prompt $prompt): JsonResponse
    {
        $prompt->increment('usage_count');

        return response()->json(['usage_count' => $prompt->usage_count]);
    }

    public function versions(Prompt $prompt): JsonResponse
    {
        return response()->json(
            $prompt->versions()->orderByDesc('version')->limit(10)->get()
        );
    }
}
