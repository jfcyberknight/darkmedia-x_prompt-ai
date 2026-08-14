<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validation des champs d'un prompt (création et mise à jour). Whitelist
 * stricte des champs attendus avec limites de longueur explicites. La
 * normalisation des tags (réindexation array_values) est appliquée après
 * validation via la surcharge de validated().
 */
class PromptRequest extends FormRequest
{
    public function authorize(): bool
    {
        // L'authentification est garantie par le middleware `auth` sur la route.
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:200'],
            'content' => ['required', 'string'],
            'description' => ['nullable', 'string', 'max:1000'],
            'category_id' => ['nullable', 'uuid', 'exists:categories,id'],
            'tags' => ['nullable', 'array', 'max:20'],
            'tags.*' => ['string', 'max:60'],
            'model' => ['nullable', 'string', 'max:120'],
            'source' => ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * Sanitization post-validation : réindexe les tags pour produire un tableau
     * séquentiel (comportement historique du contrôleur).
     *
     * @param  string|null  $key
     * @param  mixed  $default
     * @return array<string, mixed>|mixed
     */
    public function validated($key = null, $default = null): mixed
    {
        $validated = parent::validated($key, $default);

        if ($key === null) {
            $validated['tags'] = array_values($validated['tags'] ?? []);
        }

        return $validated;
    }
}
