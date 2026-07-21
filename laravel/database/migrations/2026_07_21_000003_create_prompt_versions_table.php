<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('prompt_versions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('prompt_id')->constrained('prompts')->cascadeOnDelete();
            $table->text('content');
            $table->string('title');
            $table->unsignedInteger('version');
            $table->timestamps();

            $table->index(['prompt_id', 'version']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('prompt_versions');
    }
};
