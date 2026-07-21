<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Prompt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

    public function store(Request $request): JsonResponse
    {
        $prompt = Prompt::create($this->validated($request));

        return response()->json($prompt->load('category:id,name,color'), 201);
    }

    public function update(Request $request, Prompt $prompt): JsonResponse
    {
        $prompt->update($this->validated($request));

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

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'content' => ['required', 'string'],
            'description' => ['nullable', 'string', 'max:1000'],
            'category_id' => ['nullable', 'uuid', 'exists:categories,id'],
            'tags' => ['nullable', 'array', 'max:20'],
            'tags.*' => ['string', 'max:60'],
            'model' => ['nullable', 'string', 'max:120'],
            'source' => ['nullable', 'string', 'max:500'],
        ]);

        $data['tags'] = array_values($data['tags'] ?? []);

        return $data;
    }
}
