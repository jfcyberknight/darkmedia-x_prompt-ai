<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CategoryApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_categories_require_authentication(): void
    {
        $this->getJson('/api/categories')->assertUnauthorized();
    }

    public function test_list_categories_ordered_by_name(): void
    {
        $user = User::factory()->create();

        Category::create(['name' => 'Zoo', 'color' => '#000000']);
        Category::create(['name' => 'Analyse', 'color' => '#6366f1']);
        Category::create(['name' => 'Code', 'color' => '#10b981']);

        $response = $this->actingAs($user)->getJson('/api/categories');

        $response->assertOk()
            ->assertJsonCount(3)
            ->assertJsonPath('0.name', 'Analyse')
            ->assertJsonPath('1.name', 'Code')
            ->assertJsonPath('2.name', 'Zoo');
    }

    public function test_list_categories_is_empty_by_default(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->getJson('/api/categories')
            ->assertOk()
            ->assertJsonCount(0);
    }
}
