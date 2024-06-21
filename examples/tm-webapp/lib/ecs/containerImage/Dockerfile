# Use the official httpd (Apache) image from the Docker Hub
FROM --platform=linux/x86_64 httpd:latest

# Copy the custom index.html file to the Apache HTML directory
COPY index.html /usr/local/apache2/htdocs/

# Expose port 80 to the outside world
EXPOSE 80

# Start Apache when the container starts
CMD ["httpd-foreground"]

