.PHONY: test

# L'app Laravel vit dans laravel/ (pas à la racine du repo) — voir
# laravel/Makefile pour le détail du pipeline de test.
test:
	$(MAKE) -C laravel test
