<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Prompt;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PromptApiTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    public function test_api_requires_authentication(): void
    {
        $this->getJson('/api/prompts')->assertUnauthorized();
        $this->getJson('/api/categories')->assertUnauthorized();
        $this->postJson('/api/ai', ['action' => 'ping'])->assertUnauthorized();
    }

    public function test_crud_prompt(): void
    {
        $category = Category::create(['name' => 'Code', 'color' => '#10b981']);

        // Create
        $response = $this->actingAs($this->user)->postJson('/api/prompts', [
            'title' => 'Mon prompt',
            'content' => 'Contenu du prompt',
            'description' => 'Une description',
            'category_id' => $category->id,
            'tags' => ['test', 'laravel'],
            'model' => 'claude-3',
        ]);
        $response->assertCreated()
            ->assertJsonPath('title', 'Mon prompt')
            ->assertJsonPath('tags', ['test', 'laravel'])
            ->assertJsonPath('category.name', 'Code');

        $id = $response->json('id');

        // List (avec relation catégorie)
        $this->actingAs($this->user)->getJson('/api/prompts')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.category.color', '#10b981');

        // Update
        $this->actingAs($this->user)->putJson("/api/prompts/{$id}", [
            'title' => 'Titre modifié',
            'content' => 'Contenu modifié',
            'tags' => [],
        ])->assertOk()->assertJsonPath('title', 'Titre modifié');

        // Delete
        $this->actingAs($this->user)->deleteJson("/api/prompts/{$id}")->assertOk();
        $this->assertDatabaseCount('prompts', 0);
    }

    public function test_updating_title_or_content_archives_previous_version(): void
    {
        $prompt = Prompt::create(['title' => 'V1', 'content' => 'Contenu v1']);

        $this->actingAs($this->user)->putJson("/api/prompts/{$prompt->id}", [
            'title' => 'V2',
            'content' => 'Contenu v2',
        ])->assertOk();

        $this->actingAs($this->user)->getJson("/api/prompts/{$prompt->id}/versions")
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.title', 'V1')
            ->assertJsonPath('0.content', 'Contenu v1')
            ->assertJsonPath('0.version', 1);
    }

    public function test_favorite_toggle_and_usage_counter(): void
    {
        $prompt = Prompt::create(['title' => 'P', 'content' => 'C']);

        $this->actingAs($this->user)->postJson("/api/prompts/{$prompt->id}/favorite")
            ->assertOk()->assertJsonPath('is_favorite', true);

        $this->actingAs($this->user)->postJson("/api/prompts/{$prompt->id}/favorite")
            ->assertOk()->assertJsonPath('is_favorite', false);

        $this->actingAs($this->user)->postJson("/api/prompts/{$prompt->id}/usage")
            ->assertOk()->assertJsonPath('usage_count', 1);
    }

    public function test_ai_ping_reports_key_presence_without_values(): void
    {
        config(['ai.keys.gemini' => 'secret-key']);

        $this->actingAs($this->user)->postJson('/api/ai', ['action' => 'ping'])
            ->assertOk()
            ->assertJsonPath('ok', true)
            ->assertJsonPath('configured.gemini', true)
            ->assertJsonPath('configured.openai', false)
            ->assertJsonMissing(['secret-key']);
    }

    public function test_ai_rejects_unallowed_model(): void
    {
        $this->actingAs($this->user)->postJson('/api/ai', [
            'text' => 'test',
            'provider' => 'gemini',
            'model' => 'gemini-ultra-cher/../../piege',
        ])->assertStatus(400);
    }

    public function test_validation_rejects_invalid_payload(): void
    {
        $this->actingAs($this->user)->postJson('/api/prompts', [
            'title' => '',
            'content' => '',
        ])->assertUnprocessable();
    }
}
