<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validation de la consommation (étape 2, POST) d'un lien magic link.
 * Whitelist stricte : seul le champ token est accepté, avec limites de
 * longueur explicites. L'usage unique atomique reste géré par
 * MagicLinkService::consume.
 */
class MagicLinkConsumeRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Route publique : la consommation du jeton ouvre la session.
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'token' => ['required', 'string', 'max:512'],
        ];
    }
}
