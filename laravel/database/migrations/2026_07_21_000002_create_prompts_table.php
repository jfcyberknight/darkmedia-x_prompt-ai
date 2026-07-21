<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('prompts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->text('content');
            $table->text('description')->nullable();
            $table->foreignUuid('category_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->json('tags')->nullable();
            $table->string('model')->nullable();
            $table->string('source')->nullable();
            $table->boolean('is_favorite')->default(false);
            $table->unsignedInteger('usage_count')->default(0);
            $table->timestamps();

            $table->index('is_favorite');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('prompts');
    }
};
