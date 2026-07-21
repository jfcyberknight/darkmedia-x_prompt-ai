<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Prompt extends Model
{
    use HasUuids;

    protected $fillable = [
        'title', 'content', 'description', 'category_id',
        'tags', 'model', 'source', 'is_favorite', 'usage_count',
    ];

    protected function casts(): array
    {
        return [
            'tags' => 'array',
            'is_favorite' => 'boolean',
            'usage_count' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        // Miroir du trigger Postgres save_prompt_version() : avant toute mise à
        // jour du titre ou du contenu, on archive l'ancienne version.
        static::updating(function (Prompt $prompt) {
            if (! $prompt->isDirty(['title', 'content'])) {
                return;
            }

            $nextVersion = (int) $prompt->versions()->max('version') + 1;

            $prompt->versions()->create([
                'title' => $prompt->getOriginal('title'),
                'content' => $prompt->getOriginal('content'),
                'version' => $nextVersion,
            ]);
        });
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function versions(): HasMany
    {
        return $this->hasMany(PromptVersion::class);
    }
}
