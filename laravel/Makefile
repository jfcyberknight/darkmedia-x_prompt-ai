.PHONY: test build-image

TEST_IMAGE := darkmedia-x_prompt-ai-test:latest

# Image de test PHP 8.4 (voir docker/test/Dockerfile) — l'hôte n'a que PHP
# 8.3 et l'image de prod (../Dockerfile) est buildée --no-dev (pas de
# PHPUnit). Rarement nécessaire à la main : `test` la construit si absente.
build-image:
	docker build -f docker/test/Dockerfile -t $(TEST_IMAGE) .

test: build-image
	@test -f .env.testing || cp .env.example .env.testing
	docker run --rm \
		-e APP_ENV=testing \
		-v "$(CURDIR)":/app \
		-v prompt-ai-dev-vendor:/app/vendor \
		-w /app \
		$(TEST_IMAGE) \
		sh -c "composer install --no-interaction --prefer-dist -q && \
			(grep -q '^APP_KEY=base64:' .env.testing || php artisan key:generate --env=testing --force) && \
			composer test"
