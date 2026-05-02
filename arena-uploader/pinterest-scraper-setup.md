# Setting up Environment for Pinterest Scraper

## 1. Create a project directory

First, let's create a directory for your Pinterest scraping project:

```bash
mkdir pinterest_scraper
cd pinterest_scraper
```

## 2. Set Python version for the project

Use pyenv to set the Python version for this project. Let's use Python 3.10.4:

```bash
pyenv local 3.10.4
```

This creates a `.python-version` file in your project directory, ensuring you always use Python 3.10.4 for this project.

## 3. Create and activate a virtual environment

Create a new virtual environment for this project:

```bash
python -m venv venv
source venv/bin/activate
```

Your prompt should now show `(venv)` to indicate the virtual environment is active.

## 4. Install required packages

Install the necessary packages for web scraping:

```bash
pip install requests beautifulsoup4
```

## 5. Create a requirements file

Create a `requirements.txt` file to easily recreate this environment later:

```bash
pip freeze > requirements.txt
```

## 6. Create your Python script

Now, create a new Python file for your scraper. Let's call it `pinterest_scraper.py`:

```bash
touch pinterest_scraper.py
```

## 7. Add the scraper code

Open `pinterest_scraper.py` in your preferred text editor and paste in the Pinterest scraper code we developed earlier. You can refer to the "Pinterest Scraper Script" artifact for the code.

## 8. Customize the script

Modify the `main()` function in `pinterest_scraper.py` with your Pinterest credentials and the board URL you want to scrape:

```python
def main():
    email = "your_email@example.com"
    password = "your_password"
    board_url = "https://www.pinterest.com/username/boardname/"
    output_dir = "pinterest_data"

    login_to_pinterest(email, password)
    pin_data = scrape_pinterest_board(board_url)
    save_pin_data(pin_data, output_dir)

if __name__ == "__main__":
    main()
```

## 9. Run the scraper

With your virtual environment still active, run the scraper:

```bash
python pinterest_scraper.py
```

This will execute your script and start scraping the specified Pinterest board.

## 10. Deactivate the environment

When you're done working on the project, deactivate the virtual environment:

```bash
deactivate
```

Remember to activate the virtual environment (`source venv/bin/activate`) whenever you return to work on this project.
