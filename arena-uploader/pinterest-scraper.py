import requests
from bs4 import BeautifulSoup
import json
import os
import time
import random

def login_to_pinterest(email, password):
    session = requests.Session()
    login_url = 'https://www.pinterest.com/login/'
    
    # First, get the login page to retrieve any necessary cookies
    response = session.get(login_url)
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Extract CSRF token (Pinterest might use a different name for this)
    csrf_token = soup.find('input', {'name': 'csrfmiddlewaretoken'})['value']
    
    # Prepare login data
    login_data = {
        'email': email,
        'password': password,
        'csrfmiddlewaretoken': csrf_token
    }
    
    # Set headers to mimic a browser
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': login_url
    }
    
    # Attempt login
    response = session.post(login_url, data=login_data, headers=headers, allow_redirects=True)
    
    # Check if login was successful
    if 'Welcome to Pinterest' in response.text:
        print("Login successful!")
        return session
    else:
        print("Login failed. Please check your credentials.")
        return None

def scrape_pinterest_board(session, board_url, max_pins=None, delay_range=(1, 3)):
    pins_scraped = 0
    page = 1
    all_pin_data = []

    while True:
        # Construct URL for pagination
        url = f"{board_url}?page={page}"
        
        # Add a delay before each request
        time.sleep(random.uniform(*delay_range))

        response = session.get(url)
        soup = BeautifulSoup(response.text, 'html.parser')

        # Find all pin elements
        pins = soup.find_all('div', class_='Pin')

        if not pins:
            break  # No more pins to scrape

        for pin in pins:
            # Extract pin data
            image_url = pin.find('img')['src']
            description = pin.find('div', class_='description').text if pin.find('div', class_='description') else ''
            
            all_pin_data.append({
                'image_url': image_url,
                'description': description,
                # Add more metadata fields as needed
            })

            pins_scraped += 1
            if max_pins and pins_scraped >= max_pins:
                return all_pin_data

        page += 1

    return all_pin_data

def save_pin_data(pin_data, output_dir):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    for i, pin in enumerate(pin_data):
        # Download image
        image_response = requests.get(pin['image_url'])
        image_filename = f"image_{i}.jpg"
        with open(os.path.join(output_dir, image_filename), 'wb') as f:
            f.write(image_response.content)

        # Create markdown file
        markdown_content = f"# Pin {i}\n\n![Pin Image]({image_filename})\n\n{pin['description']}\n"
        with open(os.path.join(output_dir, f"pin_{i}.md"), 'w') as f:
            f.write(markdown_content)

        # Add a delay between saving each pin to avoid overloading the system
        time.sleep(random.uniform(0.5, 1.5))

def main():
    email = "your_email@example.com"
    password = "your_password"
    board_url = "https://www.pinterest.com/username/boardname/"
    output_dir = "pinterest_data"
    max_pins = 100  # Set to None to scrape all pins
    delay_range = (2, 5)  # Random delay between 2 and 5 seconds

    session = login_to_pinterest(email, password)
    if session:
        pin_data = scrape_pinterest_board(session, board_url, max_pins, delay_range)
        save_pin_data(pin_data, output_dir)
    else:
        print("Scraping aborted due to login failure.")

if __name__ == "__main__":
    main()
