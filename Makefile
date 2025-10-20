.PHONY: backend-image frontend-image staff-image images clean-images

backend-image:
	docker build -f backend/Dockerfile -t kudos-backend .

frontend-image:
	docker build -f frontend/Dockerfile -t kudos-frontend .

staff-image:
	docker build -f staff/Dockerfile -t kudos-staff .

images: backend-image frontend-image staff-image

clean-images:
	-@docker rmi kudos-backend kudos-frontend kudos-staff 2>/dev/null || true
