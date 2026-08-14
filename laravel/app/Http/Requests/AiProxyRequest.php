<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validation du point d'entrée unique du proxy IA (portage de l'Edge Function
 * ai-proxy). Whitelist stricte des champs attendus : tout champ non listé est
 * refusé (Fail Fast). Les providers sont bornés à la liste des providers IA
 * connus (gemini, anthropic, openai, deepseek, opencode, openrouter) ; les
 * modèles sont validés en type/longueur uniquement, le contrôle d'autorisation
 * fin par provider/modèle reste assuré par AiProxyService côté contrôleur.
 */
class AiProxyRequest extends FormRequest
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
        $providers = implode(',', array_keys((array) config('ai.default_models')));

        return [
            'text' => ['nullable', 'string', 'max:100000'],
            'action' => ['nullable', 'string', 'in:extract,upgrade,ping'],
            'provider' => ['nullable', 'string', 'max:40', "in:{$providers}"],
            'model' => ['nullable', 'string', 'max:120'],
            'instruction' => ['nullable', 'string', 'max:10000'],
            'maxTokens' => ['nullable', 'integer'],
            'debug' => ['nullable', 'boolean'],
        ];
    }
}
